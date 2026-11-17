const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS geoportal_snapshots (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    retrieved_at TIMESTAMPTZ NOT NULL,
    source_date TEXT NULL,
    source_url TEXT NOT NULL,
    payload JSONB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS station_observations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    snapshot_id BIGINT NOT NULL REFERENCES geoportal_snapshots(id) ON DELETE CASCADE,
    postal_code TEXT NULL,
    address TEXT NULL,
    opening_hours TEXT NULL,
    autonomous_community_id TEXT NULL,
    station_id TEXT NULL,
    municipality_id TEXT NULL,
    province_id TEXT NULL,
    latitude NUMERIC NULL,
    locality TEXT NULL,
    longitude NUMERIC NULL,
    margin TEXT NULL,
    municipality TEXT NULL,
    price NUMERIC NULL,
    province TEXT NULL,
    submission TEXT NULL,
    brand TEXT NULL,
    sale_type TEXT NULL
  );

  CREATE INDEX IF NOT EXISTS station_observations_snapshot_id_idx
    ON station_observations (snapshot_id);
  CREATE INDEX IF NOT EXISTS geoportal_snapshots_retrieved_at_idx
    ON geoportal_snapshots (retrieved_at DESC);
`;

export async function ensureDatabaseSchema(database: {
  query(queryText: string): Promise<unknown>;
}): Promise<void> {
  await database.query(SCHEMA_SQL);
}

const STATION_FIELDS = [
  ['postal_code', 'C.P.'],
  ['address', 'Dirección'],
  ['opening_hours', 'Horario'],
  ['autonomous_community_id', 'IDCCAA'],
  ['station_id', 'IDEESS'],
  ['municipality_id', 'IDMunicipio'],
  ['province_id', 'IDProvincia'],
  ['latitude', 'Latitud'],
  ['locality', 'Localidad'],
  ['longitude', 'Longitud (WGS84)'],
  ['margin', 'Margen'],
  ['municipality', 'Municipio'],
  ['price', 'PrecioProducto'],
  ['province', 'Provincia'],
  ['submission', 'Remisión'],
  ['brand', 'Rótulo'],
  ['sale_type', 'Tipo Venta'],
] as const;

const STATION_INSERT = `
  INSERT INTO station_observations (
    snapshot_id, ${STATION_FIELDS.map(([field]) => field).join(', ')}
  ) VALUES (
    $1, ${STATION_FIELDS.map((_, index) => `$${index + 2}`).join(', ')}
  )
`;

interface TransactionClient {
  query(queryText: string, values?: any[]): Promise<{ rows: any[] }>;
  release(): void;
}

interface ConnectionPool {
  connect(): Promise<TransactionClient>;
}

function sourceText(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value);
}

function sourceNumber(value: unknown): string | null {
  const text = sourceText(value)?.trim();
  if (!text) {
    return null;
  }
  const normalized = text.replace(',', '.');
  return Number.isFinite(Number(normalized)) ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function persistGeoportalDataset(
  pool: ConnectionPool,
  retrievedAt: Date,
  sourceDate: string | null,
  sourceUrl: string,
  dataset: unknown,
): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const snapshot = await client.query(
      `INSERT INTO geoportal_snapshots (retrieved_at, source_date, source_url, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [retrievedAt, sourceDate, sourceUrl, JSON.stringify(dataset)],
    );

    const snapshotId = snapshot.rows[0].id as string;
    const stations = isRecord(dataset) && Array.isArray(dataset.ListaEESSPrecio)
      ? dataset.ListaEESSPrecio
      : [];

    for (const station of stations) {
      if (!isRecord(station)) {
        continue;
      }

      const values = STATION_FIELDS.map(([field, sourceField]) =>
        field === 'latitude' || field === 'longitude' || field === 'price'
          ? sourceNumber(station[sourceField])
          : sourceText(station[sourceField]),
      );
      await client.query(STATION_INSERT, [snapshotId, ...values]);
    }

    await client.query('COMMIT');
    return stations.filter(isRecord).length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
