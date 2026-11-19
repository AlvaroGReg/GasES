import { Pool } from 'pg';
import { ensureDatabaseSchema, persistGeoportalDataset } from '@gases/database';
import { ingestDataset } from './geoportal';

const GEOPORTAL_URL =
  'https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/7';
const REQUEST_TIMEOUT_MS = 30_000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set to persist Geoportal snapshots.');
}

const pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 30_000 });

let shuttingDown = false;
let activeRequest: AbortController | undefined;

function requestShutdown(): void {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info('Received a termination signal; stopping the worker.');
  activeRequest?.abort();

}

async function retrieveDataset(): Promise<void> {
  activeRequest = new AbortController();

  try {
    const { retrievedAt, stationCount } = await ingestDataset(
      GEOPORTAL_URL,
      AbortSignal.any([activeRequest.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]),
      (retrievedAt, sourceDate, dataset) =>
        persistGeoportalDataset(pool, retrievedAt, sourceDate, GEOPORTAL_URL, dataset),
    );

    console.info(
      `Geoportal response and ${stationCount} station observations stored at ${retrievedAt.toISOString()}.`,
    );
  } finally {
    activeRequest = undefined;
  }
}

async function run(): Promise<void> {
  console.info('Worker run started.');

  try {
    await ensureDatabaseSchema(pool);
    if (!shuttingDown) {
      await retrieveDataset();
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
