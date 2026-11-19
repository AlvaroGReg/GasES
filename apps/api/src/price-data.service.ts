import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set for the API.');
}

const SNAPSHOT_DATES = `
  SELECT snapshot.id, snapshot.source_date, snapshot.retrieved_at,
         CASE
           WHEN snapshot.source_date ~ '^\\d{2}[-/]\\d{2}[-/]\\d{4}'
             THEN to_date(replace(substring(snapshot.source_date FROM 1 FOR 10), '-', '/'), 'DD/MM/YYYY')
           WHEN snapshot.source_date ~ '^\\d{4}-\\d{2}-\\d{2}'
             THEN to_date(substring(snapshot.source_date FROM 1 FOR 10), 'YYYY-MM-DD')
           ELSE NULL
         END AS data_date
  FROM geoportal_snapshots AS snapshot
`;

const PROVINCE_SNAPSHOTS = `
  SELECT dates.id AS snapshot_id,
         dates.source_date,
         dates.retrieved_at,
         dates.data_date,
         observation.province_id,
         MAX(observation.province) AS province,
         AVG(observation.price) AS price,
         COUNT(*)::INTEGER AS observation_count,
         BOOL_OR(dates.source_date ~ '00:00:00$') AS historical_snapshot
  FROM (${SNAPSHOT_DATES}) AS dates
  JOIN station_observations AS observation ON observation.snapshot_id = dates.id
  WHERE dates.data_date IS NOT NULL
    AND observation.province_id IS NOT NULL
    AND observation.province_id <> ''
    AND observation.price > 0
  GROUP BY dates.id, dates.source_date, dates.retrieved_at, dates.data_date, observation.province_id
`;

function numericFields<T extends Record<string, unknown>>(row: T, fields: string[]): T {
  const result: Record<string, unknown> = { ...row };
  for (const field of fields) {
    const value = result[field];
    if (value !== null && value !== undefined) {
      result[field] = Number(value);
    }
  }
  return result as T;
}

@Injectable()
export class PriceDataService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: DATABASE_URL });

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async latest() {
    const result = await this.pool.query<{
      national: {
        price: number;
        provinceCount: number;
        stationObservationCount: number;
        dataDateFrom: string;
        dataDateTo: string;
        retrievedAtFrom: string;
        retrievedAtTo: string;
      } | null;
      provinces: Array<{
        provinceId: string;
        province: string | null;
        price: number;
        observationCount: number;
        dataDate: string;
        sourceDate: string | null;
        retrievedAt: string;
      }>;
    }>(
      `WITH province_snapshots AS (${PROVINCE_SNAPSHOTS}),
       latest_provinces AS (
         SELECT DISTINCT ON (province_id) province_id, province, price, observation_count,
                data_date, source_date, retrieved_at, historical_snapshot
         FROM province_snapshots
         ORDER BY province_id, data_date DESC, historical_snapshot ASC,
                  retrieved_at DESC, snapshot_id DESC
       ),
       fresh_provinces AS (
         SELECT * FROM latest_provinces
         WHERE data_date >= CURRENT_DATE - INTERVAL '1 month'
            AND data_date <= CURRENT_DATE
       ),
       national_average AS (
         SELECT COUNT(*)::INTEGER AS province_count,
                AVG(price) AS price,
                COALESCE(SUM(observation_count), 0)::INTEGER AS station_observation_count,
                MIN(data_date) AS data_date_from,
                MAX(data_date) AS data_date_to,
                MIN(retrieved_at) AS retrieved_at_from,
                MAX(retrieved_at) AS retrieved_at_to
         FROM fresh_provinces
       )
       SELECT
         CASE WHEN national_average.province_count = 0 THEN NULL
              ELSE jsonb_build_object(
                'price', ROUND(national_average.price, 4),
                'provinceCount', national_average.province_count,
                'stationObservationCount', national_average.station_observation_count,
                'dataDateFrom', national_average.data_date_from::TEXT,
                'dataDateTo', national_average.data_date_to::TEXT,
                'retrievedAtFrom', to_char(
                  national_average.retrieved_at_from AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                ),
                'retrievedAtTo', to_char(
                  national_average.retrieved_at_to AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                )
              )
         END AS national,
         COALESCE(
           (SELECT jsonb_agg(
              jsonb_build_object(
                'provinceId', province_id,
                'province', province,
                'price', ROUND(price, 4),
                'observationCount', observation_count,
                'dataDate', data_date::TEXT,
                'sourceDate', source_date,
                'retrievedAt', to_char(
                  retrieved_at AT TIME ZONE 'UTC',
                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                )
              )
              ORDER BY province, province_id
            )
            FROM latest_provinces),
           '[]'::JSONB
         ) AS provinces
       FROM national_average`,
    );

    const calculatedAt = new Date().toISOString();
    const { national, provinces } = result.rows[0];
    return {
      national: national === null ? null : { ...national, calculatedAt },
      provinces,
    };
  }

  async history(provinceId: string | undefined, period: string | undefined) {
    const periods: Record<string, string> = {
      '1y': '1 year',
      '6m': '6 months',
      '3m': '3 months',
      '1m': '1 month',
    };
    if (period === undefined || !Object.hasOwn(periods, period)) {
      throw new BadRequestException('period must be one of: 1y, 6m, 3m, 1m.');
    }
    if (provinceId !== undefined && !/^\d+$/.test(provinceId)) {
      throw new BadRequestException('provinceId must be a Geoportal province identifier.');
    }

    const interval = periods[period];
    const snapshots = await this.pool.query(
      `WITH province_snapshots AS (${PROVINCE_SNAPSHOTS}),
       selected_snapshots AS (
         SELECT DISTINCT ON (province_id, data_date) *
         FROM province_snapshots
         WHERE data_date >= CURRENT_DATE - $1::INTERVAL
           AND data_date <= CURRENT_DATE
           AND ($2::TEXT IS NULL OR province_id = $2)
         ORDER BY province_id, data_date, historical_snapshot ASC, retrieved_at DESC, snapshot_id DESC
       )
       SELECT data_date::TEXT AS date, ROUND(AVG(price), 4) AS price,
              COUNT(*)::INTEGER AS "provinceCount",
              SUM(observation_count)::INTEGER AS "stationObservationCount",
              MIN(data_date)::TEXT AS "dataDateFrom", MAX(data_date)::TEXT AS "dataDateTo",
              MIN(retrieved_at) AS "retrievedAtFrom", MAX(retrieved_at) AS "retrievedAtTo",
              MIN(source_date) AS "sourceDate", MIN(retrieved_at) AS "retrievedAt",
              SUM(observation_count)::INTEGER AS "observationCount"
       FROM selected_snapshots
       GROUP BY data_date
       ORDER BY data_date ASC`,
      [interval, provinceId ?? null],
    );

    const calculatedAt = new Date().toISOString();
    return snapshots.rows.map((row) => {
      const common = numericFields(row, ['price']);
      if (provinceId !== undefined) {
        return {
          date: common.date,
          price: common.price,
          observationCount: Number(common.observationCount),
          sourceDate: common.sourceDate,
          retrievedAt: common.retrievedAt,
        };
      }
      return {
        date: common.date,
        price: common.price,
        provinceCount: Number(common.provinceCount),
        stationObservationCount: Number(common.stationObservationCount),
        dataDateFrom: common.dataDateFrom,
        dataDateTo: common.dataDateTo,
        retrievedAtFrom: common.retrievedAtFrom,
        retrievedAtTo: common.retrievedAtTo,
        calculatedAt,
      };
    });
  }

  async recentObservations(limit: number | undefined) {
    const boundedLimit = limit ?? 20;
    if (!Number.isInteger(boundedLimit) || boundedLimit < 1 || boundedLimit > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100.');
    }

    const result = await this.pool.query(
      `WITH current_snapshot AS (
         SELECT snapshot.id, snapshot.source_date, snapshot.retrieved_at
         FROM geoportal_snapshots AS snapshot
         WHERE snapshot.source_date !~ '00:00:00$'
           AND EXISTS (
             SELECT 1 FROM station_observations AS valid_observation
             WHERE valid_observation.snapshot_id = snapshot.id
               AND valid_observation.price > 0
           )
         ORDER BY snapshot.retrieved_at DESC, snapshot.id DESC
         LIMIT 1
       )
       SELECT observation.station_id AS "stationId", observation.brand,
              observation.locality, observation.municipality,
              observation.province_id AS "provinceId", observation.province,
              observation.price, snapshot.source_date AS "sourceDate",
              snapshot.retrieved_at AS "retrievedAt"
       FROM current_snapshot AS snapshot
       JOIN station_observations AS observation ON observation.snapshot_id = snapshot.id
       WHERE observation.price > 0
       ORDER BY observation.province, observation.municipality, observation.station_id
       LIMIT $1`,
      [boundedLimit],
    );
    return result.rows.map((row) => numericFields(row, ['price']));
  }
}
