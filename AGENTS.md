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

### Interpretation and limitations

- The data consists of prices published by land-based stations, not home-delivery quotes. Do not present them as the guaranteed price of filling a tank.
- Coverage for gas oil C is limited and uneven; the number and identity of stations can change over time. Do not assume a fixed list or coverage in every area.
- National and provincial averages of available stations are not necessarily representative of the national or local market. Document how they are calculated, their coverage, and the number of observations; do not invent data for provinces without coverage.
- The relationship between the Spanish European Oil Bulletin series and the Geoportal has not been verified. Do not claim that they are independent sources or that one derives from the other without evidence.
- Direct distributors have been ruled out as sources for this stage. Do not add other sources without an explicit user decision.

## Functional direction

- Alerts will use two aggregated references: the national average price and the average for the user's selected province. Alerts for individual stations are out of scope.
- A decrease in the national average must be able to trigger an alert even if the provincial price has not changed. Include both available references so users can decide whether to contact their distributor; explicitly indicate when provincial data is unavailable and do not assign it a date or freshness it does not have.
- Calculate the national average as the arithmetic mean of all valid prices in the daily query, and each provincial average from the valid prices for that province. For now, ignore station identity when calculating averages.
- Receiving valid data for a province counts as an update even if its prices match the previous values. If no data is received, retain its last average and retrieval date; a later query with no provincial data must not make it appear more recent.
- Follow the [Frontend SDD](specs/frontend/sdd.md) for frontend structure, page content, theme, navigation, map presentation, and history requirements. The React map uses `d3-geo`; see `tech.md` for the architecture decision.
- The user provides an email address, province, and target price. A newly updated national or provincial average at or below the target may trigger an alert. The notification includes both available references, their dates, and a reminder to contact the distributor; an old provincial average does not trigger an alert on its own.
- Send at most one email per user every seven days, grouping alerts that qualify at send time. Do not evaluate that user's alerts during the waiting period; after it ends, new valid data may trigger another email if a condition is still met. Configurable frequency is deferred.
- Allow subscriptions to be created and cancelled. Cancellation must exclude the alert from active alerts; whether to delete it or retain it as inactive, as well as the data-retention policy, remains undecided.
- A backend worker will query the source daily at 23:00 UTC through a Railway cron, evaluate conditions, and send emails without relying on open browser sessions. The UTC time remains constant year-round.
- Store relevant dates: at least the source date when available and the time of our query. Do not trigger alerts from old data or failed queries.
- If historical data is stored, retain station identity and data provenance so trends can be interpreted even when the sample changes.

## Architecture and implementation criteria

- Organize the project as a pnpm-workspaces monorepo with at least a React frontend, a NestJS API, and a separate worker, all in TypeScript. Use PostgreSQL for persistence.
- The backend is responsible for subscriptions, scheduled execution, and notifications. The API exposes data and alert management to the frontend.
- Separate access to the Geoportal from alert logic so it can be tested and adapted if the source changes.
- Handle source failures and unexpected responses; retain the last valid data with its date without presenting it as newly updated.
- Avoid querying the Geoportal for each user: share queries and evaluate alerts against centrally obtained data.
- Use Docker and Railway for deployment, initially with a development environment only. Use a basic PostgreSQL setup; decide on the backup system before the project starts. Brevo is the selected transactional email provider; account setup, a sender domain, and its DNS configuration are deferred until the project is further along. See `tech.md` for the architecture and open questions.
- Keep this file up to date when the user confirms decisions that change scope or architecture.

## Documentation language

- Write all project documentation in English, including Markdown files such as this guide and `tech.md`.
