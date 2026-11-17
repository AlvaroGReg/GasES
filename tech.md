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
  worker/    Geoportal ingestion and persistence
packages/    Shared code, as needed
```

The web app uses React with Vite. Local development uses Docker Compose Watch for the API, web app, and worker, with PostgreSQL running in a persistent named volume. Run `pnpm dev` to start the stack. The frontend build tooling is selected; database access technology and schema tooling remain pending.

PostgreSQL provides shared persistence. The package structure and database access approach will be decided during implementation. Go may be considered later if a specific need arises; it is not part of the initial implementation.

### Responsibilities

| Component | Responsibility |
| --- | --- |
| Frontend | Display backend-calculated national and provincial references, historical series, and station observations; allow users to create and cancel alerts. |
| NestJS API and backend domain services | Read persisted source data, calculate and expose price references and history, manage subscriptions, evaluate alerts, and coordinate notifications. |
| Worker | Retrieve Geoportal responses, perform ingestion-level checks, and persist the complete response and station observations to PostgreSQL. It handles ingestion only; the backend owns derived calculations and alert behavior. |
| PostgreSQL | Store the data needed for prices, subscriptions, and notification state. |

Deployment will use Docker and Railway, initially with a development environment only. The worker will be a separate Railway cron service: it retrieves and persists source data, completes its job, and exits. The API/backend owns derived price data; calculations are not duplicated in the worker or frontend. Brevo has been selected for transactional email. Account setup, the sender domain, and its DNS configuration will be handled when the project is further along. No message queue is assumed.

## Price retrieval

### Source

The initial query is [EstacionesTerrestres/FiltroProducto/7](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/7), where `7` identifies gas oil C. The service also provides historical queries by date (`dd-MM-yyyy`): `EstacionesTerrestresHist/FiltroProducto/{DATE}/7`.

The Geoportal indicates that its current response is updated every half hour. The application will query it once per day; this does not imply that every station's price has changed.

### Scheduling

Railway cron runs the worker once every 24 hours at **23:24 UTC**, using the expression `24 23 * * *`. This time was selected because the first observed response with changed station prices was retrieved at 23:24 UTC (snapshot 27, compared with snapshot 26). UTC remains constant year-round; local time in Spain changes with daylight saving time. Each run must finish before the next scheduled execution.

One query is shared by all users. The API and frontend read persisted data instead of querying the Geoportal for each request or user.

### Validation and calculation

1. The worker retrieves and persists each successful source response, recording the query time and, when available, the source date. It retains the complete source payload and related station observations.
2. A price is valid only when it parses as a numeric value greater than zero. Persist invalid or missing parsed prices as SQL `NULL`, while preserving the original value in the raw payload, so they cannot enter an average accidentally.
3. The backend calculates each provincial average as the arithmetic mean of valid station prices from that province's latest snapshot containing valid prices. The home/map reference for each province is its latest valid provincial average, with its original source and retrieval dates.
4. The latest national average is calculated from the latest valid provincial averages whose source data date is no more than one calendar month old. Each province contributes its latest available provincial value; older source data is excluded regardless of its later backfill/import time. Provinces are equally weighted regardless of their station counts.
5. Calculate from unrounded values, then round derived backend values to four decimal places. The frontend formats prices to two decimal places and never uses display-rounded values in calculations.
6. Expose each reference with its observation count, source snapshot, and source/retrieval dates. A dataset with no valid prices does not produce a new reference.

Station identity is ignored when calculating averages; stations are not specially weighted. If individual observations are stored historically, retain their identity and provenance so changes in the sample can be interpreted. Stations entering or leaving the sample can affect the average even when other stations' prices do not change.

Receiving one or more valid prices for a province updates its average and retrieval date, even if the result has not changed. If none are received, retain the latest provincial average with its original dates. A province with no data must be distinguishable from one with an older observation. The national average excludes a provincial reference once its source data date is more than one calendar month old. These are backend read/calculation semantics; the frontend displays the values and dates supplied by the API without recalculating them.

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

On API startup, check which historical source dates are already stored for the current year and query missing dates from January 1 through yesterday using `EstacionesTerrestresHist/FiltroProducto/{DATE}/7`. The backfill runs asynchronously so the API can start serving requests while it runs. A PostgreSQL advisory lock prevents concurrent API instances from performing the same backfill simultaneously. As of **2026-11-17**, the endpoint accepted dates through **2026-11-16** (320 calendar dates inclusive from January 1); the current day is not available from this historical endpoint yet. Do not create fabricated station observations for dates with an empty or invalid response. Save successful responses in the same snapshot and observation tables, including the raw payload, source `Fecha`, and actual backfill `retrieved_at`. Missing or failed dates are eligible for retry the next time the API starts.

Historical responses have `Fecha` at `00:00:00`; that value is sufficient to distinguish them from ordinary current-price responses, so no separate historical-origin flag is required solely for that distinction. Backfilled historical records are not new live updates and must not trigger alerts. Keep any already captured live snapshots as separate observations; the historical endpoint does not recreate intraday calls.

Store amounts with suitable decimal precision. Round calculated backend values to four decimal places and display prices to two decimal places in the frontend. Compare thresholds using calculated values, not strings formatted for display.

## API and testing

The API must allow clients to retrieve backend-calculated national and provincial references, daily chronological history for 1-year, 6-month, 3-month, and 1-month ranges, recent station observations, and their provenance dates, as well as create or cancel subscriptions. The API owns all average and history calculations; the frontend only formats values and renders map comparisons and chart points. Logical data requirements and calculation semantics are described in the [Frontend SDD](specs/frontend/sdd.md). Concrete routes, response envelopes, and subscription identification and cancellation mechanisms remain to be defined during API contract design.

Keep the Geoportal adapter separate from calculations and alert logic. In particular, test average calculations with partial or invalid data, retention of provincial dates, evaluation based on new references, the weekly email limit, grouping, and source or sending failures. Verify that cron is configured for 23:24 UTC (`24 23 * * *`).

## Deployment

- Railway will initially host only the development environment. The specific services and Dockerfiles will be defined when implementing the monorepo.
- Start with basic PostgreSQL and persistent storage. Decide and prepare the backup system before the project starts.
- Railway cron starts the worker; the worker does not need a public domain to perform its job. Alert sending will be integrated with Brevo when the pending email configuration is addressed.

## Pending decisions

- Railway service configuration.
- Brevo setup: create/configure the account, obtain a sender domain, authenticate it in DNS (SPF, DKIM, and DMARC), store the API key as a secret, and test sending. This will be addressed when the project is further along.
- PostgreSQL backup and restore system before project launch.
- Alert-specific freshness threshold, retries, recovery, and partial-failure handling.
- API contracts, input validation, email normalization, and subscription management mechanisms.
- Alert deletion or deactivation and data and history retention policy.
- PostgreSQL access technology and frontend tooling beyond React/Vite and `d3-geo` for the provincial map.
