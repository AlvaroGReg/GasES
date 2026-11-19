# Agent Guide

## Project goal

Build an alert service for the price of heating gas oil C in Spain. Users can subscribe to a price condition and receive a notification when it is met. A frontend will let users view the data and manage alerts.

The product priority is to make alerts work without requiring the user to keep the website open.

## Initial data source

The initial source is the Ministry's official REST service associated with the Fuel Geoportal:

- [Available operations](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help).
- [Current gas oil C prices](https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/7). The product identifier is `7`.
- To query a historical date: `EstacionesTerrestresHist/FiltroProducto/{DATE}/7`, with the date formatted as `dd-MM-yyyy`.

The current-price response indicates updates every half hour. This does not mean that every station changes its price that often.

### Stored response and station fields

Retain each complete Geoportal response unchanged in `geoportal_snapshots.payload` (JSONB). The top-level source fields are `Fecha`, `Nota`, `ListaEESSPrecio`, and `ResultadoConsulta`. Each station item has these 17 source fields:

`C.P.`, `Dirección`, `Horario`, `IDCCAA`, `IDEESS`, `IDMunicipio`, `IDProvincia`, `Latitud`, `Localidad`, `Longitud (WGS84)`, `Margen`, `Municipio`, `PrecioProducto`, `Provincia`, `Remisión`, `Rótulo`, `Tipo Venta`.

Store each station item as a related historical observation as well. Database and code-facing names use English `snake_case`, with an explicit mapping to source fields; preserve the original source keys and values in the raw payload. Keep identifiers as text and parse source prices for numeric calculations.

Record both the source `Fecha` exactly as received and our actual query/import time (`retrieved_at`). Historical endpoint responses return `Fecha` at `00:00:00`; this is sufficient to distinguish the initial historical backfill from ordinary current-price queries, so a separate origin flag is not required solely for that distinction.

### Interpretation and limitations

- The data consists of prices published by land-based stations, not home-delivery quotes. Do not present them as the guaranteed price of filling a tank.
- Coverage for gas oil C is limited and uneven; the number and identity of stations can change over time. Do not assume a fixed list or coverage in every area.
- National and provincial averages of available stations are not necessarily representative of the national or local market. Document how they are calculated, their coverage, and the number of observations; do not invent data for provinces without coverage.
- The relationship between the Spanish European Oil Bulletin series and the Geoportal has not been verified. Do not claim that they are independent sources or that one derives from the other without evidence.
- Direct distributors have been ruled out as sources for this stage. Do not add other sources without an explicit user decision.

## Functional direction

- Alerts will use two aggregated references: the national average price and the average for the user's selected province. Alerts for individual stations are out of scope.
- A decrease in the national average must be able to trigger an alert even if the provincial price has not changed. Include both available references so users can decide whether to contact their distributor; explicitly indicate when provincial data is unavailable and do not assign it a date or freshness it does not have.
- A valid price is a numeric value greater than zero. Persist every source observation and preserve the complete raw response; store an invalid or missing parsed price as `NULL` so it cannot enter an average accidentally.
- For each province, use its latest snapshot with valid prices and calculate the arithmetic mean of valid station prices in that snapshot only; do not merge snapshots or carry forward a station's last-known price. Keep the provincial reference even when its source date is old and preserve its source/retrieval dates and observation count.
- Calculate the latest national average from latest provincial references whose source date is within the last calendar month, with one equally weighted contribution per province regardless of station count. A backfill/import time must not make old source data fresh. Provinces without a recent snapshot are excluded from the national average but remain on the map with their latest available provincial average. The selected-province detail shows individual valid station prices from the exact snapshot used for its average.
- Round calculated values to four decimal places in the backend; the frontend displays prices to two decimal places. Do not use rounded display values for further calculations.
- Province identity is a stable code, never the display name. Use the Geoportal province identifier as text; display names or normalized slugs are labels/mapping keys only. Postal codes identify station locations, not provinces.
- Follow the [Frontend SDD](specs/frontend/sdd.md) for frontend structure, page content, theme, navigation, map presentation, and history requirements. The React map uses `d3-geo`; see `tech.md` for the architecture decision.
- The user provides an email address, province, and target price. A newly updated national or provincial average at or below the target may trigger an alert. The notification includes both available references, their dates, and a reminder to contact the distributor; an old provincial average does not trigger an alert on its own.
- Send at most one email per user every seven days, grouping alerts that qualify at send time. Do not evaluate that user's alerts during the waiting period; after it ends, new valid data may trigger another email if a condition is still met. Configurable frequency is deferred.
- Allow subscriptions to be created and cancelled. Cancellation must exclude the alert from active alerts; whether to delete it or retain it as inactive, as well as the data-retention policy, remains undecided.
- The worker will query the current-price source once every 24 hours at 23:24 UTC through a Railway cron (`24 23 * * *`) and persist the retrieved source data. It is an ingestion component and does not calculate averages or historical series. Backend services own derived price data and alert behavior without relying on open browser sessions. This time was selected because the first observed changed response was retrieved at 23:24 UTC. The UTC time remains constant year-round.
- In local development, the worker performs one query per start and does not poll periodically. The source watcher can restart it when code changes.
- Initially backfill the historical endpoint for each available date from 2026-01-01 onward. On 2026-11-17, the endpoint's latest available date was 2026-11-16; availability can advance as the source publishes data. Keep the original source date and the actual import time, and do not treat historical backfill as newly received data for alert triggering. The frontend history starts with daily data and offers 1-year, 6-month, 3-month, and 1-month ranges; do not group points into weeks in the initial version.
- Store relevant dates: at least the source date when available and the time of our query. Do not trigger alerts from old data or failed queries.
- If historical data is stored, retain station identity and data provenance so trends can be interpreted even when the sample changes.

## Architecture and implementation criteria

- Organize the project as a pnpm-workspaces monorepo with at least a React frontend, a NestJS API, and a separate worker, all in TypeScript. Use PostgreSQL for persistence.
- The backend is responsible for subscriptions, scheduled execution, and notifications. The API exposes data and alert management to the frontend.
- Separate access to the Geoportal from alert logic so it can be tested and adapted if the source changes.
- Handle source failures and unexpected responses; retain the last valid data with its date without presenting it as newly updated.
- Avoid querying the Geoportal for each user: share queries and evaluate alerts against centrally obtained data.
- Use Docker and Railway for deployment, initially with a development environment only. Use a basic PostgreSQL setup without backups for now: the stored source data can be queried again from the historical API, although individual live snapshots and import times cannot necessarily be recovered. Revisit this decision before storing subscriptions or other non-recoverable data. Brevo is the selected transactional email provider; account setup, a sender domain, and its DNS configuration are deferred until the project is further along. See `tech.md` for the architecture and open questions.
- Keep this file up to date when the user confirms decisions that change scope or architecture.

## Documentation language

- Write all project documentation in English, including Markdown files such as this guide and `tech.md`.
