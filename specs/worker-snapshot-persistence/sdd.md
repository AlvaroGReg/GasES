# Worker Snapshot Persistence — Basic Software Design Description

> Historical specification: the local 30-minute polling experiment has ended. The worker now performs one query per start.

## Purpose

Define the smallest design needed for the worker to persist each successful current-price query to PostgreSQL during a local data-observation run. The captured snapshots will be reviewed before deciding whether to continue or change the approach.

This document extends the local polling behavior in [Local Worker Polling](../local-worker-polling/spec.md). For this observation run, the polling interval is **30 minutes** instead of 60 seconds.

## Scope

- Query the Geoportal current-price endpoint for gas oil C (product `7`).
- Make the first query immediately, then start subsequent cycles at 30-minute intervals without overlapping requests.
- Persist every successful response as a separate database record.
- Keep the complete source response, including station identifiers, prices, and source-provided fields, for later analysis.
- Record the local retrieval time separately from the source's `Fecha` value.

This increment does not calculate averages, evaluate alerts, send email, expose data through the API, or change the production Railway cron schedule.

## Design overview

The worker remains responsible for retrieving the shared dataset. After receiving a successful HTTP response and parsing valid JSON, it inserts one snapshot into PostgreSQL. The complete response is stored as JSONB so that this observation run preserves the source data and provenance without prematurely fixing a normalized station schema.

The worker uses the existing `DATABASE_URL` connection setting. The PostgreSQL service and its persistent development volume are already defined in Docker Compose. The database client library and schema/migration tooling remain implementation choices; this design does not select an ORM.

```text
Geoportal current-price endpoint
              │
              ▼
        Local worker ──────► PostgreSQL: geoportal_snapshots
              │
              └────────────► console status/errors
```

## Data source

```text
https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/7
```

The endpoint returns the current published dataset for land-based stations. A stored row is one response observed by this application; it is not an individual station submission or a guarantee that every source update has been captured.

## Persistence model

Create a `geoportal_snapshots` table with the following logical fields:

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | Generated primary key | Identifies this captured response. |
| `retrieved_at` | `TIMESTAMPTZ NOT NULL` | UTC time when the worker began retrieving this response. |
| `source_date` | `TEXT NULL` | The source's `Fecha` value, preserved as returned when present. |
| `source_url` | `TEXT NOT NULL` | Endpoint queried, including the product filter. |
| `payload` | `JSONB NOT NULL` | Complete parsed JSON response without filtering or aggregation. |

Each successful polling cycle inserts a new row, even when its payload matches a previous response. Do not deduplicate snapshots: repeated observations and their retrieval times are relevant to this experiment.

Only successful HTTP responses containing valid JSON are persisted. Failed requests, non-success HTTP statuses, and invalid JSON are reported to the console and do not create a snapshot. A database insertion failure is reported with the retrieval timestamp; the worker continues with later cycles. A failed insert must not be reported as a successfully stored snapshot.

The insert is one database operation per response. A row is either stored with its complete payload and metadata or not stored; partial station-level writes are not used in this increment.

## Polling and cycle behavior

- Use a 30-minute interval for this local observation run.
- Start the first request immediately after worker startup.
- Do not start another cycle while the preceding request and database insert are still in progress.
- If a cycle takes longer than 30 minutes, start the next cycle as soon as it completes.
- A source or database failure does not terminate the worker; the next cycle is still scheduled.
- On `SIGINT` or `SIGTERM`, stop scheduling cycles and exit cleanly.

This interval is a temporary observation setting. Whether it should be configurable and what interval should be used after this analysis are open decisions.

## Logging

Continue printing a timestamped success or error message to the console. A success message should make clear that the response was stored and identify the retrieval timestamp. The database is the durable record of successful snapshots; no JSON files are part of this design.

## Acceptance criteria

1. Starting the worker performs a Geoportal query immediately.
2. A valid successful response creates exactly one `geoportal_snapshots` row containing the retrieval time, source date when present, queried URL, and full response payload.
3. Two consecutive identical responses are stored as two distinct snapshots.
4. A failed request or invalid JSON creates no snapshot, is reported to the console, and does not prevent a later cycle.
5. A database insertion error is reported and does not terminate future polling cycles.
6. No polling cycle overlaps an active retrieval or persistence operation.
7. The development database retains snapshots when the worker container is restarted, using the existing PostgreSQL persistent volume.

## Out of scope

- Normalizing station records into a separate table.
- Calculating national or provincial averages.
- Alert evaluation, subscriptions, and email delivery.
- API or frontend changes.
- Historical endpoint queries or assumptions that they contain every intraday update.
- Changes to the production daily Railway cron.
- Data cleanup, retention, or backup policy.

## Decisions deferred for review

- Whether JSONB snapshots are sufficient or station-level rows are needed for analysis.
- Whether to retain all snapshots and what retention policy to use.
- Whether to add indexes beyond the primary key.
- Whether the interval should be configurable and what the long-term schedule should be.
- Whether to validate additional source fields or reject unexpected-but-valid JSON responses.
- The database client and migration/schema tooling.
