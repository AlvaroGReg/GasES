import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ingestDataset, validateDataset } from './geoportal';

const valid = {
  Fecha: '19/11/2026 9:59:50',
  Nota: 'Source note',
  ResultadoConsulta: 'OK',
  ListaEESSPrecio: [{ IDEESS: '01', PrecioProducto: '1,234' }],
};

test('accepts a valid Geoportal response without changing it', () => {
  assert.equal(validateDataset(valid), valid.Fecha);
});

test('rejects failed, partial and malformed responses', () => {
  for (const dataset of [
    { ...valid, ResultadoConsulta: 'ERROR' },
    { ...valid, ListaEESSPrecio: [null] },
    { ...valid, Fecha: '99/99/2026 9:59:50' },
    { ...valid, Fecha: '29/02/2025 9:59:50' },
    { ...valid, Fecha: '19/11/2026 25:00:00' },
    { ...valid, Fecha: '19/11/2026 9:59:50 garbage' },
    { ...valid, Nota: null },
    null,
  ]) {
    assert.throws(() => validateDataset(dataset));
  }
});

test('accepts a leap day and an empty successful dataset', () => {
  assert.equal(validateDataset({ ...valid, Fecha: '29/02/2024 00:00:00', ListaEESSPrecio: [] }), '29/02/2024 00:00:00');
});

test('persists the original validated response with its source date', async () => {
  let saved: unknown;
  const result = await ingestDataset('https://example.test', new AbortController().signal,
    async (retrievedAt, sourceDate, dataset) => {
      assert.ok(retrievedAt instanceof Date);
      assert.equal(sourceDate, valid.Fecha);
      saved = dataset;
      return 1;
    }, async () => new Response(JSON.stringify(valid)));
  assert.deepEqual(saved, valid);
  assert.equal(result.stationCount, 1);
});

test('does not persist HTTP errors, invalid JSON, invalid responses or aborted requests', async () => {
  let saves = 0;
  const persist = async () => { saves++; return 0; };
  for (const response of [
    () => new Response('', { status: 503 }),
    () => new Response('not json'),
    () => new Response(JSON.stringify({ ...valid, ResultadoConsulta: 'ERROR' })),
  ]) {
    await assert.rejects(ingestDataset('https://example.test', new AbortController().signal,
      persist, async () => response()));
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(ingestDataset('https://example.test', controller.signal, persist,
    async () => new Response(JSON.stringify(valid))));
  assert.equal(saves, 0);
});

test('propagates persistence failures', async () => {
  await assert.rejects(ingestDataset('https://example.test', new AbortController().signal,
    async () => { throw new Error('database unavailable'); },
    async () => new Response(JSON.stringify(valid))), /database unavailable/);
});
