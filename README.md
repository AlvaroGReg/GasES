# Heating oil price alerts

A pnpm workspace for the React frontend, NestJS API, and scheduled worker.

## Development

Requirements: Docker Desktop with Docker Compose v2 and Node.js with Corepack.

```sh
corepack enable
corepack pnpm install
corepack pnpm dev
```

`pnpm dev` starts PostgreSQL, the API, the frontend, and the worker with Docker Compose Watch enabled. Source changes are synchronized into the app containers; changes to package manifests rebuild them.

- Frontend: <http://localhost:5173>
- API health check: <http://localhost:3000/health>
- PostgreSQL: `localhost:5432` (database `gases_dev`)

To stop the development services without deleting database data:

```sh
corepack pnpm dev:down
```

The PostgreSQL data is stored in the `postgres_data` Docker volume. On startup, the API asynchronously checks for historical snapshots from January 1 of the current year through yesterday and fetches missing dates from the Geoportal's history endpoint. Failed or unavailable dates are retried at the next API startup. The worker polls the current-price endpoint every 30 minutes and stores each successful response in `geoportal_snapshots` as JSONB, together with normalized station records in `station_observations`. Both tables are initialized automatically and the volume retains their data when containers restart. The API exposes:

- `GET /snapshots?limit=100` for recent snapshot metadata.
- `GET /snapshots/latest` for the most recent full response with normalized station observations.
- `GET /prices/latest` for provincial averages from each province's latest valid snapshot and a national average that includes only provinces with a snapshot from the last calendar month.
- `GET /prices/history?period=1y` for national history. Supported periods are `1y`, `6m`, `3m`, and `1m`; add `provinceId=<Geoportal ID>` for a provincial series.
- `GET /prices/observations?limit=20` for a bounded list of station prices from the latest current-price snapshot (limit 1–100).
