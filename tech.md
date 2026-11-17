# Technical Architecture

This document describes the initial design of the gas oil C alert application. Functional decisions and agent instructions are in [AGENTS.md](AGENTS.md). Items marked as pending have not been decided.

## Goal and scope

Query gas oil C prices published by land-based stations on the Geoportal daily, calculate national and provincial reference prices, display them in a frontend, and send email alerts without requiring users to keep the website open.

The averages are indicators of the available stations, not delivery quotes and not necessarily representative of the market. They must be accompanied by their date, observation count, and an explanation of their coverage. Alerts invite users to contact their distributor.

The initial source is the [Ministry's official REST service](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help). Direct distributors and other sources are out of scope at this stage.

## Monorepo

A single repository with pnpm workspaces and independent TypeScript applications:

```text
apps/
  web/       React frontend
  api/       NestJS API
  worker/    Data retrieval, evaluation, and notifications
packages/    Shared code, as needed
```

The web app uses React with Vite. Local development uses Docker Compose Watch for the API, web app, and worker, with PostgreSQL running in a persistent named volume. Run `pnpm dev` to start the stack. The frontend build tooling is selected; database access technology and schema tooling remain pending.

PostgreSQL provides shared persistence. The package structure and database access approach will be decided during implementation. Go may be considered later if a specific need arises; it is not part of the initial implementation.

### Responsibilities

| Component | Responsibility |
| --- | --- |
| Frontend | Display the national average, provincial map, and each data point's date; allow users to create and cancel alerts. |
| NestJS API | Expose prices and subscription management; read from and write to PostgreSQL. |
| Worker | Query the Geoportal, validate and store data, calculate averages, evaluate eligible alerts, and send emails. It runs independently of the browser and API. |
| PostgreSQL | Store the data needed for prices, subscriptions, and notification state. |

Deployment will use Docker and Railway, initially with a development environment only. The worker will be a separate Railway cron service: it runs, completes its job, and exits. Brevo has been selected for transactional email. Account setup, the sender domain, and its DNS configuration will be handled when the project is further along. No message queue is assumed.

## Price retrieval

### Source

The initial query is [EstacionesTerrestres/FiltroProducto/7](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/7), where `7` identifies gas oil C. The service also provides historical queries by date (`dd-MM-yyyy`): `EstacionesTerrestresHist/FiltroProducto/{DATE}/7`.

The Geoportal indicates that its current response is updated every half hour. The application will query it once per day; this does not imply that every station's price has changed.

### Scheduling

Railway cron runs the worker once every 24 hours at **23:24 UTC**, using the expression `24 23 * * *`. This time was selected because the first observed response with changed station prices was retrieved at 23:24 UTC (snapshot 27, compared with snapshot 26). UTC remains constant year-round; local time in Spain changes with daylight saving time. Each run must finish before the next scheduled execution.

One query is shared by all users. The API and frontend read persisted data instead of querying the Geoportal for each request or user.

### Validation and calculation

1. Retrieve a daily snapshot and record the query time and, when available, the source date.
2. Validate the response and its prices; exclude invalid prices. The specific validation criteria must be defined when implementing the adapter.
3. Calculate the national arithmetic mean from **all valid prices in that daily query**. Do not combine older snapshots to fill gaps.
4. Calculate each provincial average as the arithmetic mean of the valid prices received for that province.
5. Store each average with its observation count, provenance, and dates. A dataset with no valid prices does not produce a new average.

Station identity is ignored when calculating averages; stations are not specially weighted. If individual observations are stored historically, retain their identity and provenance so changes in the sample can be interpreted. Stations entering or leaving the sample can affect the average even when other stations' prices do not change.

Receiving one or more valid prices for a province updates its average and retrieval date, even if the result has not changed. If none are received, retain the latest provincial average with its original date. A province with no data must be distinguishable from one with an older observation.

If a query fails, its response is unexpected, or it contains no valid data, do not replace the last valid value with an empty one or assign it a new date. Do not generate alerts from failed queries or old data. Validate source responses and dates before treating a snapshot as eligible for alerts; the exact staleness threshold remains pending.

## Subscriptions and alerts

Each subscription associates an email address, a province, and a target price in €/litre. The email address identifies the user for notification frequency limits.

An eligible subscription meets its condition when a **newly updated** reference is less than or equal to the target:

- A new national average can trigger an alert even if the province has not received new data.
- A provincial average can trigger an alert when new valid data for that province is received, even if the prices match the previous values.
- A provincial average retained from an earlier query does not trigger an alert on its own. It may be included in the email with its own date; if it has never existed, state that provincial data is unavailable.

The email includes both available references, their dates, and a reminder to contact the distributor. It must not present an average as a guaranteed delivery price.

### Frequency and cancellation

- Send at most **one email per address every seven days**, grouping alerts that qualify at send time.
- Do not evaluate that address's alerts during the waiting period. When it ends, evaluate again when new valid data arrives; if a condition is still met, another email may be sent.
- Frequency is fixed initially; configurable frequency is out of scope for the first release.
- Create and cancel subscriptions through the API from the frontend. Cancellation must exclude the alert from active alerts. Whether to physically delete or retain it as inactive, and the retention policy, remain undecided.

Persist the state needed to enforce the email limit across process restarts. Design execution to avoid duplicate emails on retries or concurrent runs; record send outcomes and ensure failed notifications are not presented as sent. Retry details and Brevo guarantees remain pending.

## Frontend architecture

The frontend is a React application built with Vite. Its page, navigation, theme, and map requirements are described in the [Frontend SDD](specs/frontend/sdd.md). The provincial map uses **`d3-geo`** to project province GeoJSON and render it as SVG; the current implementation fetches the boundary asset at runtime and maps source province names in the Home page.

## Initial data model

The PostgreSQL ORM or client has not yet been decided. At minimum, the model must represent:

| Information | Required data |
| --- | --- |
| Query | Outcome, query time, and source date when available. |
| Average | National or provincial scope, price, observation count, source query, and its own retrieval date. |
| Subscription | Email, province, target price, and a status that allows cancelled subscriptions to be excluded from active alerts. |
| Notification | Email, send time and outcome, included alerts, and enough information to enforce the seven-day wait. |
| Station observation | Snapshot, station identity, province, source fields, parsed price, and query/source dates. |

### Geoportal snapshot and station-observation tables

Use a relational parent-child model:

- `geoportal_snapshots`: one row per successful source response, with `id`, `retrieved_at` (`timestamptz` for our actual query/import time), `source_date` (the Geoportal's `Fecha` string exactly as returned), `source_url`, and the complete unmodified `payload` (`jsonb`).
- `station_observations`: one row for each station in a snapshot, related by `snapshot_id` foreign key. Use `(snapshot_id, station_id)` as a unique key when station IDs are present and unique in the response. Capture station attributes on each observation so historical changes to a station's province or address are not overwritten by newer data.

Use English `snake_case` for database and internal field names. Map the source station keys explicitly:

| Source field | Internal field | Type |
| --- | --- | --- |
| `C.P.` | `postal_code` | `text` |
| `Dirección` | `address` | `text` |
| `Horario` | `opening_hours` | `text` |
| `IDCCAA` | `autonomous_community_id` | `text` |
| `IDEESS` | `station_id` | `text` |
| `IDMunicipio` | `municipality_id` | `text` |
| `IDProvincia` | `province_id` | `text` |
| `Latitud` | `latitude` | `numeric` |
| `Localidad` | `locality` | `text` |
| `Longitud (WGS84)` | `longitude` | `numeric` |
| `Margen` | `margin` | `text` |
| `Municipio` | `municipality` | `text` |
| `PrecioProducto` | `price` | `numeric` |
| `Provincia` | `province` | `text` |
| `Remisión` | `submission` | `text` |
| `Rótulo` | `brand` | `text` |
| `Tipo Venta` | `sale_type` | `text` |

Keep identifiers as text, including leading zeroes. Parse decimal commas for relational numeric fields; the raw `payload` retains the exact source strings and keys. Store `source_date` without assigning an assumed timezone; `retrieved_at` is an independent UTC-aware timestamp.

### Initial historical backfill

Before regular live updates, query `EstacionesTerrestresHist/FiltroProducto/{DATE}/7` once per available date starting **2026-01-01**. As of **2026-11-17**, the endpoint accepted dates through **2026-11-16** (320 calendar dates inclusive from January 1); the current day is not available from this historical endpoint yet. Do not create fabricated station observations for dates with an empty or invalid response. Save successful responses in the same snapshot and observation tables, including the raw payload, source `Fecha`, and actual backfill `retrieved_at`.

Historical responses have `Fecha` at `00:00:00`; that value is sufficient to distinguish them from ordinary current-price responses, so no separate historical-origin flag is required solely for that distinction. Backfilled historical records are not new live updates and must not trigger alerts. Keep any already captured live snapshots as separate observations; the historical endpoint does not recreate intraday calls.

Store amounts with suitable decimal precision and document the rounding policy. Compare thresholds using calculated values, not strings formatted for display.

## API and testing

The API must allow clients to retrieve available references and their dates, obtain data for the map, and create or cancel subscriptions. Routes, formats, and subscription identification and cancellation mechanisms will be defined during API contract design.

Keep the Geoportal adapter separate from calculations and alert logic. In particular, test average calculations with partial or invalid data, retention of provincial dates, evaluation based on new references, the weekly email limit, grouping, and source or sending failures. Verify that cron is configured for 23:24 UTC (`24 23 * * *`).

## Deployment

- Railway will initially host only the development environment. The specific services and Dockerfiles will be defined when implementing the monorepo.
- Start with basic PostgreSQL and persistent storage. Decide and prepare the backup system before the project starts.
- Railway cron starts the worker; the worker does not need a public domain to perform its job. Alert sending will be integrated with Brevo when the pending email configuration is addressed.

## Pending decisions

- Railway service configuration.
- Brevo setup: create/configure the account, obtain a sender domain, authenticate it in DNS (SPF, DKIM, and DMARC), store the API key as a secret, and test sending. This will be addressed when the project is further along.
- PostgreSQL backup and restore system before project launch.
- Specific source-freshness threshold, retries, recovery, and partial-failure handling.
- API contracts, input validation, email normalization, and subscription management mechanisms.
- Alert deletion or deactivation and data and history retention policy.
- PostgreSQL access technology and frontend tooling beyond React/Vite and `d3-geo` for the provincial map.
- Historical data loading strategy, if historical data is offered; verify the availability and semantics of the official history endpoint.
