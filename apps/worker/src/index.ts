import { Pool } from 'pg';

const GEOPORTAL_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/7';
const POLLING_INTERVAL_MS = 30 * 60_000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to persist Geoportal snapshots.');
}

const pool = new Pool({ connectionString: DATABASE_URL });

let shuttingDown = false;
let activeRequest: AbortController | undefined;
let pendingTimer: ReturnType<typeof setTimeout> | undefined;
let resolvePendingTimer: (() => void) | undefined;

function requestShutdown(): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info('Received a termination signal; stopping the worker.');
  activeRequest?.abort();

  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = undefined;
    resolvePendingTimer?.();
    resolvePendingTimer = undefined;
  }
}

function waitForNextCycle(delayMs: number): Promise<void> {
  if (shuttingDown || delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    resolvePendingTimer = resolve;
    pendingTimer = setTimeout(() => {
      pendingTimer = undefined;
      resolvePendingTimer = undefined;
      resolve();
    }, delayMs);
  });
}

async function retrieveDataset(): Promise<void> {
  const retrievedAt = new Date();
  activeRequest = new AbortController();

  try {
    const response = await fetch(GEOPORTAL_URL, {
      signal: activeRequest.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Geoportal returned HTTP ${response.status} ${response.statusText}`.trim(),
      );
    }

    const dataset: unknown = await response.json();
    if (shuttingDown) {
      return;
    }

    const sourceDate =
      typeof dataset === 'object' && dataset !== null && 'Fecha' in dataset &&
      typeof dataset.Fecha === 'string'
        ? dataset.Fecha
        : null;

    await pool.query(`
      CREATE TABLE IF NOT EXISTS geoportal_snapshots (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        retrieved_at TIMESTAMPTZ NOT NULL,
        source_date TEXT NULL,
        source_url TEXT NOT NULL,
        payload JSONB NOT NULL
      )
    `);

    await pool.query(
      `INSERT INTO geoportal_snapshots (retrieved_at, source_date, source_url, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [retrievedAt, sourceDate, GEOPORTAL_URL, JSON.stringify(dataset)],
    );

    console.info(`Geoportal response stored at ${retrievedAt.toISOString()}.`);
  } catch (error) {
    if (shuttingDown && error instanceof Error && error.name === 'AbortError') {
      return;
    }

    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Geoportal snapshot failed at ${retrievedAt.toISOString()}: ${detail}`);
  } finally {
    activeRequest = undefined;
  }
}

async function run(): Promise<void> {
  console.info('Worker development polling started.');

  try {
    while (!shuttingDown) {
      const cycleStartedAt = Date.now();
      await retrieveDataset();

      const delayMs = Math.max(
        0,
        cycleStartedAt + POLLING_INTERVAL_MS - Date.now(),
      );
      await waitForNextCycle(delayMs);
    }
  } finally {
    await pool.end();
  }

  console.info('Worker stopped.');
}

process.once('SIGINT', requestShutdown);
process.once('SIGTERM', requestShutdown);

void run().catch((error: unknown) => {
  console.error('Worker stopped unexpectedly:', error);
  process.exitCode = 1;
});
