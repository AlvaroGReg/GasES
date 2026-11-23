# Frontend — Software Design Description

## Purpose

Describe the full GasEs frontend: its shared shell, navigation, theme preference, user-facing pages, data-source explanation, and current implementation status. The overall application architecture is in [Technical Architecture](../../tech.md).

## Scope

- Present national gas oil C price information published by Spain's Fuel Geoportal.
- Provide Home, Information, and About views.
- Allow the user to select a province on an interactive map.
- Explain the currently known data source and link to the project's repository.
- Support light and dark themes.
- Keep all user-facing text in a typed localization catalog. Spanish (`es-ES`), Galician (`gl-ES`), Basque (`eu-ES`), and Catalan (`ca-ES`) are available.
- Define the price-data contract the frontend consumes from the API, including derived references, history, and recent station observations.
- Document current API integration status and any remaining placeholders.

Subscription creation and cancellation are part of the product scope but are deferred to the final project phase. Until that phase, the Home page keeps a coming-soon alert callout and has no subscription form or management view.

## Frontend structure

The React frontend uses this structure:

```text
apps/web/src/
  components/
    Footer.tsx
    Header.tsx
    LogoConcepts.tsx
  pages/
    AboutPage.tsx
    HomePage.tsx
    InformationPage.tsx
  styles/
    components/
    pages/
    global.css
    theme.css
  App.tsx
  i18n.tsx
  main.tsx
  types.ts
```

- `main.tsx` mounts the React app and loads the global foundation and theme stylesheets.
- `App.tsx` selects the active page, manages the theme, and renders the shared header and footer around the page.
- `components/` contains the shared header, footer, and brand mark; each component imports its own stylesheet from `styles/components/`.
- `pages/` contains the Home, Information, and About page views; each page imports its own stylesheet from `styles/pages/`. The content pages also share `content-page.css`.
- `styles/global.css` defines global tokens, resets, and the page shell. `styles/theme.css` applies the shared light and dark theme palette.
- `types.ts` defines the page and theme unions shared between components.
- `i18n.tsx` defines the available locale identifiers and message catalogs, the localization provider, and locale-aware formatting configuration. The provider restores the saved locale, otherwise uses browser preferences and falls back to Spanish. The header language selector is a compact flag-only control for Spain, Galicia, the Basque Country, and Catalonia.

## Navigation and shared shell

The app supports these hash routes:

| View | Route | Initial view |
| --- | --- | --- |
| Home | `#/inicio` | Yes |
| Information | `#/informacion` | No |
| About us | `#/sobre` | No |

The footer provides in-app links. The app also responds to browser back and forward navigation. Selecting an in-app link replaces the page content without a full page reload. The brand link returns to Home. The header's **Create alert** action points to the Home alert banner, which is currently marked as coming soon.

The shared header and footer appear on all three views.

The header places the flag-only language selector beside the theme toggle. Activating it opens the available language flags; each choice has an accessible localized name and the selected locale is saved in local storage.

## Theme preference

- Support light and dark themes across all views.
- Before React renders, select the initial theme from the saved `gases-theme` preference (`light` or `dark`), falling back to the operating system's `prefers-color-scheme` setting when no valid saved choice exists.
- The theme-toggle icon in the header is accessible by keyboard and exposes an action-specific accessible label.
- Toggling changes the theme and stores the explicit choice in local storage.
- While the user has no saved choice, follow changes to the operating system theme. A saved choice takes precedence until the user changes it.
- Apply the selected theme to the header, page content, interactive map, footer, and browser theme color.

## Pages

### Home (`#/inicio`)

Render the observatory in this order:

1. **National average:** Show the national price in €/litre, the number of contributing provinces, the underlying station-observation count, and the source-data date range. Explain that it is an average of prices published by land-based stations, not a home-delivery quote.
2. **National price history:** Show the national daily history, with 1-year, 6-month, 3-month, and 1-month selectors. The map selection does not change this chart. Keep missing observations as gaps and do not imply interpolation or a new retrieval.
3. **Latest observations:** Show station and province where available, published price, and the source-data date. Identify these as station prices, not delivery quotes. Do not show a separate retrieval-time column.
4. **Alert callout:** The current page presents a coming-soon callout for email alerts. It does not yet provide a subscription form.
5. **Provincial map:** Show province boundaries and allow selecting a province. Show each province's latest valid average, its source and retrieval dates, and its valid station observation count. If a province has no data, state that without inventing a value or date. The map is a latest-reference view and does not filter or otherwise affect the national price history.

#### Data contract and calculation ownership

The API is the frontend's source for price data. It reads the persisted Geoportal snapshots and station observations and returns the derived values needed by the Home page. The worker retrieves and persists source responses; it does not calculate averages or history. The frontend must not calculate national or provincial averages from station rows or combine snapshots to construct a historical series.

The Home page needs these logical datasets. They may be exposed by separate endpoints or a combined response; route names and HTTP pagination are an API implementation detail and remain to be defined.

| Logical dataset | Required fields | Use |
| --- | --- | --- |
| Latest national reference | `price`, `provinceCount`, `stationObservationCount`, `dataDateFrom`, `dataDateTo`, `retrievedAtFrom`, `retrievedAtTo`, `calculatedAt` | National price card and map comparison baseline. Date ranges describe the source and retrieval dates of contributing provincial references; `calculatedAt` is when the backend produced this aggregate. |
| Latest provincial references | `provinceId`, `province`, `price`, `observationCount`, `dataDate`, `sourceDate`, `retrievedAt` | Map colors and selected-province detail. One item per province with any valid historical reference; its age is reflected in the map color. Provinces without valid history are absent and render as no data. |
| Stations in selected provincial reference | `stationId`, `brand`, `locality`, `municipality`, `price`, `sourceDate`, `retrievedAt` | Selected-province detail. Show each valid station observation from the exact snapshot used to calculate that province's displayed average. |
| Historical series | `date`, `price`, `provinceCount`, `stationObservationCount`, `dataDateFrom`, `dataDateTo`, `retrievedAtFrom`, `retrievedAtTo`, `calculatedAt` | National daily history. A period selector chooses 1y, 6m, 3m, or 1m. |
| Recent station observations | `stationId`, `brand`, `locality`, `municipality`, `provinceId`, `province`, `price`, `sourceDate`, `retrievedAt` | Latest-observations table. Optional station text fields may be null when the source omits them. |

Prices are numeric values in €/litre, not localized strings. A valid source price is numeric and greater than zero. Persist an invalid or missing parsed price as `NULL`; preserve its original source value in the complete raw payload. Null prices never contribute to averages. `observationCount` is the number of valid station prices used in one provincial average; `stationObservationCount` is the sum of those contributing observations and is coverage metadata, not a weighting factor for the national average. `provinceCount` is the number of contributing provinces. `sourceDate` preserves the source's `Fecha` value exactly; `retrievedAt` is the UTC timestamp for the stored query/import. A provincial reference and its station detail share the source and retrieval dates of the exact snapshot used. For a national aggregate, `dataDateFrom`/`dataDateTo` and `retrievedAtFrom`/`retrievedAtTo` give the oldest and newest source and retrieval dates among contributing provinces, and `calculatedAt` is the backend calculation time. `date` is the history point's calendar date (`YYYY-MM-DD`) used for ordering and chart labels. The frontend formats numbers and timestamps for the active locale; it does not use formatted values in calculations.

For each provincial reference, select that province's latest snapshot containing valid prices and calculate the arithmetic mean of the valid station prices in that snapshot. Do not merge observations across snapshots or use each station's last-known value. Keep the reference even when its source date is old, and preserve the snapshot's source/retrieval dates and observation count. The national average uses only these latest provincial references whose source date is within the last calendar month, with one equal-weight contribution per province; a backfill/import timestamp does not make old source data fresh. Provinces without a recent snapshot are excluded from the national average but retain their latest reference on the map. Station counts are coverage metadata, not a weighting factor. Calculate from unrounded values, round backend results to four decimal places, and display prices to two decimal places in the frontend. Group observations by the source province identifier (`IDProvincia`/`provinceId`), retained as text; province names or normalized slugs are labels/mapping keys only. Postal codes identify station locations and are not province identifiers.

The latest national average includes only latest provincial snapshots whose source date is within the last calendar month. Each snapshot's valid station prices form one provincial average, and those provincial averages are equally weighted. If no provinces have a recent snapshot, the API represents the national reference as unavailable (`null`), never as zero.

Each latest provincial reference comes from the latest snapshot containing valid prices for that province, regardless of age. A later snapshot with no valid prices does not replace it. Selecting a province also shows the valid station prices from that same snapshot individually, so the displayed station rows explain the provincial mean. A province with no valid historical snapshot is omitted from the provincial-reference dataset and has no price, date, or count to display.

Historical series are daily and contain at most one point per calendar source date. For each province and date, select its latest snapshot containing valid prices, preferring a valid current-price snapshot over a historical-backfill snapshot; use the backfill snapshot only when no valid current-price snapshot exists for that province and date. Calculate a national history point from the provinces with valid data for that date, with one equal-weight contribution per province. Do not carry provincial values forward from earlier dates. Return points in ascending date order; dates with no data remain gaps (or explicit null-price points), never interpolated. Keep each point's source and retrieval provenance. The selectors request the last year, 6 months, 3 months, or 1 month. Return daily points in all ranges; do not group results into weeks in the initial version. Historical backfill records provide history only and are not new live updates. The initial backfill begins at 2026-01-01; actual chart coverage depends on which source dates have valid data.

Recent station observations are valid priced station rows from the latest valid current-price snapshot, not a claim that those stations changed most recently. Each row carries the snapshot's source and retrieval dates in the API response. The table displays the source-data date, but does not need a separate retrieval-time (“Recuperado”) column. Keep the set bounded for the page and expose more records only through API pagination if that is later required.

For the map, use the latest available national and provincial references; it is a current/latest view, not a historical range. Provinces without a provincial reference use the no-data color. The age fade is based on the provincial reference's own `dataDate`, not the time when a historical record was imported or the latest national query time. Selecting a province shows its average, count, source/retrieval dates, and the individual valid station prices from the same snapshot, or an explicit no-data message. The map's color calculation remains a visual comparison, not a price-average calculation.

For the chart, request API-supplied national daily history for the selected period, and plot points in date order. Province selection on the map does not change the chart's scope. Keep gaps visible, and do not infer a price or retrieval date for a missing day. Show the point's date as the history date; expose source and retrieval dates in supporting details where appropriate. Weekly/monthly grouping beyond these date ranges is out of scope for the initial version.

#### Current data integration status

The Home page consumes the API's latest references, daily history, and recent station-observation routes. The selected-province station breakdown from the exact reference snapshot is specified above but still requires its API route and UI integration. The page displays explicit loading, error, and empty states and does not fabricate prices, counts, or dates. The province boundary GeoJSON is bundled locally with the frontend rather than fetched at runtime.

The API data routes are:

| Route | Response and behavior |
| --- | --- |
| `GET /prices/latest` | `{ national, provinces }`. `national` is calculated only from the latest valid snapshot per province when its source date is in the last calendar month, with one equal-weight provincial contribution, and includes `calculatedAt`; it is `null` when no province has a recent snapshot. `provinces` includes the latest valid snapshot average for each province even when old. |
| `GET /prices/provinces/:provinceId/stations` | Planned: individual valid station observations from the exact latest valid snapshot used for the selected province's displayed average, with matching source and retrieval dates. |
| `GET /prices/history?period=1y\|6m\|3m\|1m[&provinceId=CODE]` | An ascending array of daily points. Omitting `provinceId` returns equally weighted national points; supplying a numeric Geoportal province ID returns that province's points. `period` is required. Unsupported periods or malformed province IDs return HTTP 400; a valid numeric ID with no data returns an empty array. |
| `GET /prices/observations[?limit=N]` | An array of valid-priced stations from the latest current-price snapshot. `limit` defaults to 20 and must be an integer from 1 to 100. |

The latest and history routes read persisted snapshots and perform average calculations in the API. The station observations route is bounded and does not currently paginate beyond the requested limit.

Bundle the province geometry locally with the frontend so the map does not depend on a third-party runtime request. The initial boundary dataset is the Click That ’Hood Spain provinces GeoJSON asset:

`https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson`

The page projects the local GeoJSON with `d3-geo` and renders SVG province paths. A name-alias mapping in `HomePage.tsx` maps source names to the display/application province names. Preserve the dataset's provenance and required attribution in the repository and user-facing map credits. Verify the GeoJSON's own data licensing/provenance separately from the upstream repository's software license before packaging it.

The color calculation is implemented for use when price data is supplied: below the national average is green, above it is red, and equal is white; intensity increases with the price difference and saturates at €0.25/litre. Provincial color contrast fades linearly toward gray over 90 days. Provinces without a reference are rendered in the no-data gray. Since all price arrays are empty, the colored-price behavior is not currently visible with production values.

### Information (`#/informacion`)

Identify the Fuel Geoportal's public API, published by Spain's Ministry for the Ecological Transition and the Demographic Challenge, as the source of gas oil C prices from land-based stations. Link to the API documentation and state that these prices are not home-delivery quotes. Credit the Click That ’Hood province-boundary GeoJSON here and state its copyright and MIT license, linking to the license.

Explain that the backend obtains and stores source responses, derives the displayed averages from valid station prices, and keeps source and retrieval dates distinct. State the current collection schedule only when it matches the deployed configuration. Explain that historical records can be backfilled and are used for trends, not treated as newly received live data. Continue to identify the Geoportal as the source and clarify that station prices are not delivery quotes.

### About us (`#/sobre`)

Introduce GasEs as a project to make public gas oil C prices easier to consult and follow. Link to the project repository: <https://github.com/AlvaroGReg/GasES>.

## Data interpretation

- Prices are those published by land-based stations; they are not guaranteed delivery prices or quotes.
- National and provincial averages describe available observations only. Station coverage is limited and may vary; do not imply that the sample fully represents a market or invent data for a province with no observations.
- Show retrieval/source dates and observation counts from the API. Do not assign a new date to retained provincial values or treat stale provincial data as a new observation.
- Treat a missing provincial reference as unavailable, not as zero. Do not substitute a national or neighboring-province value.
- Treat a missing historical point as a gap; do not interpolate or carry values forward.
- Display only API-calculated averages. Frontend transformations are limited to formatting, map comparison/coloring, and chart layout.

## Map implementation and presentation

- Use `d3-geo` to project province GeoJSON and render it as SVG. A tiled basemap is not required.
- Compare an available provincial average with the latest national average: below is green, above is red, equal is white.
- Increase contrast with the difference, initially saturating at €0.25/litre; fade older data toward gray over 90 days.
- Keep provinces with no data visually distinct from old observations.
- Selecting a province marks its map shape and exposes its data or an explicit no-data message beside the map.

## Open questions

- Verify and record the boundary GeoJSON's original data source, applicable license, and attribution requirements before adding it to the repository. The preferred implementation is to bundle the reviewed asset locally.
- Should the Create alert action become a form or link to a separate subscription flow, and what are the alert management routes?
