import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ensureDatabaseSchema, persistGeoportalDataset } from '@gases/database';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
const HISTORICAL_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestresHist/FiltroProducto';
const BACKFILL_LOCK_ID = 74120601;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set for the API.');
}

function sourceDateAtMidnightToIso(sourceDate: string): string | null {
  const dayFirst = sourceDate.match(/^(\d{2})[/-](\d{2})[/-](\d{4}) 0{1,2}:00:00$/);
  if (dayFirst) {
    return `${dayFirst[3]}-${dayFirst[2]}-${dayFirst[1]}`;
  }

  const iso = sourceDate.match(/^(\d{4})-(\d{2})-(\d{2})T? ?00:00:00(?:\.\d+)?Z?$/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function formatHistoricalEndpointDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

function hasStationData(dataset: unknown): dataset is Record<string, unknown> & {
  Fecha?: unknown;
  ListaEESSPrecio: unknown[];
} {
  if (typeof dataset !== 'object' || dataset === null || Array.isArray(dataset)) {
    return false;
  }

  const response = dataset as Record<string, unknown>;
  return Array.isArray(response.ListaEESSPrecio) &&
    response.ListaEESSPrecio.some(
      (station) => typeof station === 'object' && station !== null && !Array.isArray(station),
    );
}

@Injectable()
export class SnapshotsService implements OnModuleInit, OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: DATABASE_URL });
  private backfillPromise?: Promise<void>;
  private activeBackfillRequest?: AbortController;

  async onModuleInit(): Promise<void> {
    await ensureDatabaseSchema(this.pool);
    this.backfillPromise = this.backfillMissingHistoricalSnapshots().catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`Historical Geoportal backfill stopped: ${detail}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.activeBackfillRequest?.abort();
    await this.backfillPromise;
    await this.pool.end();
  }

  private async backfillMissingHistoricalSnapshots(): Promise<void> {
    const lockClient = await this.pool.connect();
    let lockAcquired = false;

    try {
      await lockClient.query('SELECT pg_advisory_lock($1)', [BACKFILL_LOCK_ID]);
      lockAcquired = true;

      const existingSnapshots = await lockClient.query<{ source_date: string | null }>(
        'SELECT source_date FROM geoportal_snapshots WHERE source_date IS NOT NULL',
      );
      const storedDates = new Set(
        existingSnapshots.rows
          .map(({ source_date }) => source_date && sourceDateAtMidnightToIso(source_date))
          .filter((date): date is string => date !== null),
      );

      const today = new Date();
      const firstDay = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      const lastAvailableDay = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 1,
      ));

      for (const date = firstDay; date <= lastAvailableDay; date.setUTCDate(date.getUTCDate() + 1)) {
        const expectedDate = date.toISOString().slice(0, 10);
        if (storedDates.has(expectedDate)) {
          continue;
        }

        if (this.activeBackfillRequest === undefined) {
          this.activeBackfillRequest = new AbortController();
        }
        const request = this.activeBackfillRequest;
        const retrievedAt = new Date();
        const sourceUrl = `${HISTORICAL_URL}/${formatHistoricalEndpointDate(date)}/7`;

        try {
          const response = await fetch(sourceUrl, {
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
          });
          if (!response.ok) {
            throw new Error(`Geoportal returned HTTP ${response.status} ${response.statusText}`.trim());
          }

          const dataset: unknown = await response.json();
          if (!hasStationData(dataset)) {
            console.info(`No historical Geoportal data for ${expectedDate}; it will be retried later.`);
            continue;
          }

          const sourceDate = typeof dataset.Fecha === 'string' ? dataset.Fecha : null;
          if (!sourceDate || sourceDateAtMidnightToIso(sourceDate) !== expectedDate) {
            console.warn(`Geoportal returned an unexpected source date for ${expectedDate}; skipped.`);
            continue;
          }

          const stationCount = await persistGeoportalDataset(
            this.pool,
            retrievedAt,
            sourceDate,
            sourceUrl,
            dataset,
          );
          storedDates.add(expectedDate);
          console.info(
            `Stored historical Geoportal snapshot for ${expectedDate} with ${stationCount} station observations.`,
          );
        } catch (error) {
          if (request.signal.aborted) {
            return;
          }
          const detail = error instanceof Error ? error.message : String(error);
          console.error(`Historical Geoportal backfill failed for ${expectedDate}: ${detail}`);
        }
      }
    } finally {
      this.activeBackfillRequest = undefined;
      if (lockAcquired) {
        await lockClient.query('SELECT pg_advisory_unlock($1)', [BACKFILL_LOCK_ID]);
      }
      lockClient.release();
    }
  }

  async list(limit = 100) {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 1000);
    const result = await this.pool.query(
      `SELECT snapshot.id, snapshot.retrieved_at, snapshot.source_date, snapshot.source_url,
              COUNT(observation.id)::INTEGER AS station_count
       FROM geoportal_snapshots AS snapshot
       LEFT JOIN station_observations AS observation ON observation.snapshot_id = snapshot.id
       GROUP BY snapshot.id
       ORDER BY snapshot.retrieved_at DESC, snapshot.id DESC
       LIMIT $1`,
      [boundedLimit],
    );
    return result.rows;
  }

  async latest() {
    const snapshot = await this.pool.query(
      `SELECT id, retrieved_at, source_date, source_url, payload
       FROM geoportal_snapshots
       ORDER BY retrieved_at DESC, id DESC
       LIMIT 1`,
    );

    if (!snapshot.rows[0]) {
      throw new NotFoundException('No Geoportal snapshots have been stored yet.');
    }

    const stations = await this.pool.query(
      `SELECT postal_code, address, opening_hours, autonomous_community_id,
              station_id, municipality_id, province_id, latitude, locality,
              longitude, margin, municipality, price, province, submission,
              brand, sale_type
       FROM station_observations
       WHERE snapshot_id = $1
       ORDER BY id`,
      [snapshot.rows[0].id],
    );

    return { ...snapshot.rows[0], stations: stations.rows };
  }
}
