# Frontend — Software Design Description

## Purpose

Describe the full GasEs frontend: its shared shell, navigation, theme preference, user-facing pages, data-source explanation, and current implementation status. The overall application architecture is in [Technical Architecture](../../tech.md).

## Scope

- Present national and provincial gas oil C price information published by Spain's Fuel Geoportal.
- Provide Home, Information, and About views.
- Allow the user to select a province on an interactive map.
- Explain the currently known data source and link to the project's repository.
- Support light and dark themes.
- Keep all user-facing text in a typed localization catalog. Spanish (`es-ES`) is the only available locale; Galician, Basque, and Catalan are planned.
- Document which parts are currently placeholders pending an API contract.

Subscription creation and cancellation are part of the frontend product direction, but there is no subscription form or management view in the current frontend.

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
- `i18n.tsx` defines the available and planned locale identifiers, the Spanish message catalog, the localization provider, and locale-aware formatting configuration. Add a message catalog before exposing a locale as available. The current interface intentionally has no language selector while Spanish is the only available locale.

## Navigation and shared shell

The app supports these hash routes:

| View | Route | Initial view |
| --- | --- | --- |
| Home | `#/inicio` | Yes |
| Information | `#/informacion` | No |
| About us | `#/sobre` | No |

The footer provides in-app links. The app also responds to browser back and forward navigation. Selecting an in-app link replaces the page content without a full page reload. The brand link returns to Home. The header's **Create alert** action points to the Home alert banner, which is currently marked as coming soon.

The shared header and footer appear on all three views.

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

1. **National average:** Show the national price in €/litre, retrieval date, and valid station observation count. Explain that it is an average of prices published by land-based stations, not a home-delivery quote.
2. **Provincial map:** Show province boundaries and allow selecting a province. When price references are available, show their average price, retrieval date, and observation count. If a province has no data, state that without inventing a value or date.
3. **Price history:** Show national history by default and switch to the selected province's history. Keep missing observations as gaps and do not imply interpolation or a new retrieval.
4. **Latest observations:** Show station and province where available, published price, and relevant source and retrieval dates. Identify these as station prices, not delivery quotes.
5. **Alert callout:** The current page presents a coming-soon callout for email alerts. It does not yet provide a subscription form.

#### Current data integration status

The national average, provincial averages, history, and latest-observation arrays in `HomePage.tsx` are currently empty placeholders. No price endpoint or homepage API contract is wired into the React app yet. Therefore the page displays empty states and does not fabricate prices, counts, or dates. Implement data retrieval after the API contract is defined.

The map's province geometry is fetched at runtime from the Click That ’Hood Spain provinces GeoJSON asset:

`https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson`

The page projects the GeoJSON with `d3-geo` and renders SVG province paths. A name-alias mapping in `HomePage.tsx` maps source names to the display/application province names. A failed geometry request is shown as a map loading error.

The color calculation is implemented for use when price data is supplied: below the national average is green, above it is red, and equal is white; intensity increases with the price difference and saturates at €0.25/litre. Provincial color contrast fades linearly toward gray over 90 days. Provinces without a reference are rendered in the no-data gray. Since all price arrays are empty, the colored-price behavior is not currently visible with production values.

### Information (`#/informacion`)

Identify the Fuel Geoportal's public API, published by Spain's Ministry for the Ecological Transition and the Demographic Challenge, as the source of gas oil C prices from land-based stations. Link to the API documentation and state that these prices are not home-delivery quotes.

The current copy deliberately does not describe request frequency, validation, persistence, or update handling. Expand it after those details are finalized and exposed by the application.

### About us (`#/sobre`)

Introduce GasEs as a project to make public gas oil C prices easier to consult and follow. Link to the project repository: <https://github.com/AlvaroGReg/GasES>.

## Data interpretation

- Prices are those published by land-based stations; they are not guaranteed delivery prices or quotes.
- National and provincial averages describe available observations only. Station coverage is limited and may vary; do not imply that the sample fully represents a market or invent data for a province with no observations.
- Show retrieval/source dates and observation counts when the API supplies them. Do not assign a new date to retained provincial values or treat stale provincial data as a new observation.

## Map implementation and presentation

- Use `d3-geo` to project province GeoJSON and render it as SVG. A tiled basemap is not required.
- Compare an available provincial average with the latest national average: below is green, above is red, equal is white.
- Increase contrast with the difference, initially saturating at €0.25/litre; fade older data toward gray over 90 days.
- Keep provinces with no data visually distinct from old observations.
- Selecting a province marks its map shape and exposes its data or an explicit no-data message beside the map.

## Open questions

- Which API endpoint and response contract will provide prices, averages, history, observation counts, and dates to the frontend?
- Should map boundaries be bundled locally rather than fetched from the external GeoJSON URL? Confirm the boundary dataset, identifier mapping, and attribution/license requirements.
- What history period and loading strategy should the chart support? Verify the official historical endpoint's availability and semantics before relying on it.
- What exact rule determines which observations appear in the latest-observations section?
- What additional API collection and update details should the Information page explain after the data pipeline is finalized?
- Should the Create alert action become a form or link to a separate subscription flow, and what are the alert management routes?
