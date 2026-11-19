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

Run the worker's automated tests with `corepack pnpm --filter @gases/worker test`.

- Frontend: <http://localhost:5173>
- API health check: <http://localhost:3000/health>
- PostgreSQL: `localhost:5432` (database `gases_dev`)

To stop the development services without deleting database data:

```sh
corepack pnpm dev:down
```

The PostgreSQL data is stored in the `postgres_data` Docker volume. On startup, the API asynchronously checks for historical snapshots from January 1 of the current year through yesterday and fetches missing dates from the Geoportal's history endpoint. Failed or unavailable dates are retried at the next API startup. The worker queries the current-price endpoint once at startup and stores each successful response in `geoportal_snapshots` as JSONB, together with normalized station records in `station_observations`. In development, the watcher runs it again when its source changes; there is no periodic local polling. Both tables are initialized automatically and the volume retains their data when containers restart. The API exposes:

- `GET /snapshots?limit=100` for recent snapshot metadata.
- `GET /snapshots/latest` for the most recent full response with normalized station observations.
- `GET /prices/latest` for provincial averages from each province's latest valid snapshot and a national average that includes only provinces with a snapshot from the last calendar month.
- `GET /prices/history?period=1y` for national history. Supported periods are `1y`, `6m`, `3m`, and `1m`; add `provinceId=<Geoportal ID>` for a provincial series.
- `GET /prices/observations?limit=20` for a bounded list of station prices from the latest current-price snapshot (limit 1–100).

## Scheduled worker

The worker performs one request and exits. It requires `DATABASE_URL`, has a 30-second Geoportal request timeout, and returns a nonzero exit code if retrieval, validation, or persistence fails. Invalid responses are not stored; successful responses retain their original payload and source date.

For a Railway worker service, use the repository root as the build context, select `docker/worker.Dockerfile`, configure `DATABASE_URL`, and set the service's cron schedule to `24 23 * * *` (23:24 UTC daily). These settings do not themselves create or deploy a Railway service. A failed run is logged and reported as failed; automatic retries and alerting are not configured.

## Railway development deployment

Create a Railway project with a development environment and four services: PostgreSQL, `api`, `web`, and `worker`. Connect the three application services to this repository, with the repository root as their root directory and build context. In each service's settings, set the **Railway config file path** to the corresponding file:

| Service | Config file | Public domain |
| --- | --- | --- |
| `api` | `/railway/api.json` | Required |
| `web` | `/railway/web.json` | Required |
| `worker` | `/railway/worker.json` | Not required |

Generate Railway domains for `api` and `web`, then set these service variables (replace service names if yours differ):

| Service | Variable | Value |
| --- | --- | --- |
| `api` | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `api` | `WEB_ORIGIN` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` |
| `worker` | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `web` | `VITE_API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |

Reference variables use the exact Railway service name, which is case-sensitive. The web image embeds `VITE_API_URL` **at build time**; changing it requires a rebuild. It must be a browser-accessible HTTPS URL, not a Railway private hostname. The API uses Railway's `PORT` and only allows the configured web origin. Deploy after the domain and variable references are set. PostgreSQL must be available before the API and worker start.

The worker configuration schedules one run daily at 23:24 UTC and disables automatic restarts; failed runs require investigation. The API initializes the schema and imports missing historical dates in the background. Check the API's `/health`, the web page and its price requests, and the worker logs after its scheduled execution. An empty database can take time to populate.

No database backups are configured for this development stage. Historical prices can be imported again, but live snapshots and their original retrieval times may not be recoverable. Revisit this before storing subscriptions or other data that cannot be recreated.
