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

The PostgreSQL data is stored in the `postgres_data` Docker volume. Database access libraries and schema tooling remain undecided.
