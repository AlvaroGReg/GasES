function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateDataset(dataset: unknown): string {
  if (!isRecord(dataset) || dataset.ResultadoConsulta !== 'OK' ||
      typeof dataset.Nota !== 'string' || !Array.isArray(dataset.ListaEESSPrecio) ||
      !dataset.ListaEESSPrecio.every(isRecord) || typeof dataset.Fecha !== 'string') {
    throw new Error('Unexpected Geoportal response structure or query result.');
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2})$/.exec(dataset.Fecha);
  if (!match) {
    throw new Error('Invalid Geoportal source date.');
  }
  const [, dayText, monthText, yearText, hourText, minuteText, secondText] = match;
  const [day, month, year, hour, minute, second] =
    [dayText, monthText, yearText, hourText, minuteText, secondText].map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) {
    throw new Error('Invalid Geoportal source date.');
  }
  return dataset.Fecha;
}

export async function ingestDataset(
  url: string,
  signal: AbortSignal,
  persist: (retrievedAt: Date, sourceDate: string, dataset: unknown) => Promise<number>,
  request: typeof fetch = fetch,
): Promise<{ retrievedAt: Date; stationCount: number }> {
  const retrievedAt = new Date();
  const response = await request(url, { signal });
  if (!response.ok) {
    throw new Error(`Geoportal returned HTTP ${response.status} ${response.statusText}`.trim());
  }
  const dataset: unknown = await response.json();
  const sourceDate = validateDataset(dataset);
  signal.throwIfAborted();
  const stationCount = await persist(retrievedAt, sourceDate, dataset);
  return { retrievedAt, stationCount };
}
