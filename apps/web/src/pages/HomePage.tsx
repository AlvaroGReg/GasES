import { useEffect, useMemo, useState } from 'react';
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import type { Theme } from '../types';

type ProvinceGeometry = { type: 'Feature'; properties: Record<string, string>; geometry: GeoPermissibleObjects };
type GeoJson = { type: 'FeatureCollection'; features: ProvinceGeometry[] };
type PriceReference = { price: number; retrievedAt: string; observationCount: number };
type Observation = { id: string; station: string; province: string; price: number; sourceDate?: string; retrievedAt: string };

// Data is intentionally empty until the API exposes the homepage price contract.
const nationalAverage: PriceReference | null = null;
const provincialAverages: Record<string, PriceReference> = {};
const observations: Observation[] = [];
const history: { date: string; price: number | null }[] = [];

const normalizeProvinceName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
const provinceAliases = new Map<string, string>([
    ['La Coruña', 'A Coruña'], ['Alacant', 'Alicante'], ['Alacant/Alicante', 'Alicante'],
    ['Araba', 'Álava'], ['Araba/Álava', 'Álava'], ['Baleares', 'Illes Balears'],
    ['Vizcaya', 'Bizkaia'], ['Bizkaia/Vizcaya', 'Bizkaia'], ['Castelló', 'Castellón'],
    ['Castelló/Castellón', 'Castellón'], ['Gerona', 'Girona'], ['Guipúzcoa', 'Gipuzkoa'],
    ['Gipuzkoa/Guipúzcoa', 'Gipuzkoa'], ['Lérida', 'Lleida'], ['Orense', 'Ourense'],
    ['Santa Cruz De Tenerife', 'Santa Cruz de Tenerife'], ['València', 'Valencia'],
    ['València/Valencia', 'Valencia'],
].map(([alias, canonical]) => [normalizeProvinceName(alias), canonical] as const));
const canaryProvinces = new Set(['Las Palmas', 'Santa Cruz de Tenerife']);

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 3 });
const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const formatDate = (date: string) => dateFormat.format(new Date(date));

type HomePageProps = { theme: Theme };

export function HomePage({ theme }: HomePageProps) {
    const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
    const [mapError, setMapError] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson', { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error('No se pudieron cargar los límites provinciales');
                return response.json() as Promise<GeoJson>;
            })
            .then(setGeoJson)
            .catch((error: unknown) => {
                if (error instanceof Error && error.name !== 'AbortError') setMapError(true);
            });
        return () => controller.abort();
    }, []);

    const mapPaths = useMemo(() => {
        if (!geoJson) return [];
        const features = geoJson.features.map((feature) => {
            const sourceName = feature.properties.name ?? feature.properties.NAME_2 ?? feature.properties.provincia ?? '';
            const name = provinceAliases.get(normalizeProvinceName(sourceName)) ?? sourceName;
            return { feature, name };
        });
        const mainlandFeatures = features.filter(({ name }) => !canaryProvinces.has(name));
        const canaryFeatures = features.filter(({ name }) => canaryProvinces.has(name));
        const projection = geoMercator().fitExtent([[150, 14], [610, 416]], {
            type: 'FeatureCollection',
            features: mainlandFeatures.map(({ feature }) => feature),
        } as never);
        const canaryProjection = geoMercator().fitExtent([[22, 354], [132, 411]], {
            type: 'FeatureCollection',
            features: canaryFeatures.map(({ feature }) => feature),
        } as never);
        const mainlandPath = geoPath(projection);
        const canaryPath = geoPath(canaryProjection);
        return features.map(({ feature, name }, index) => {
            const isCanary = canaryProvinces.has(name);
            const reference = provincialAverages[name];
            const difference = reference && nationalAverage ? reference.price - nationalAverage.price : 0;
            const intensity = Math.min(Math.abs(difference) / 0.25, 1);
            const ageDays = reference ? Math.max(0, (Date.now() - new Date(reference.retrievedAt).getTime()) / 86_400_000) : 0;
            const freshness = reference ? Math.max(0, 1 - ageDays / 90) : 0;
            const base = reference && nationalAverage
                ? difference < 0 ? `rgba(60, 139, 101, ${0.18 + intensity * 0.62})` : difference > 0 ? `rgba(206, 97, 82, ${0.18 + intensity * 0.62})` : '#fff'
                : theme === 'dark' ? '#303a33' : '#edf0ec';
            const faded = reference && freshness < 1 ? `color-mix(in srgb, ${base} ${Math.round(freshness * 100)}%, #b9c1bb)` : base;
            return {
                key: `${name}-${index}`,
                name,
                d: (isCanary ? canaryPath : mainlandPath)(feature as GeoPermissibleObjects) ?? '',
                fill: faded,
                price: reference?.price,
                isCanaryProvince: isCanary,
            };
        });
    }, [geoJson, theme]);

    const selectedAverage = selectedProvince ? provincialAverages[selectedProvince] : null;
    const chartTitle = selectedProvince ? `Evolución en ${selectedProvince}` : 'Evolución nacional';
    const renderProvince = (province: (typeof mapPaths)[number]) => <path key={province.key} d={province.d} fill={province.fill} className={`province-shape ${selectedProvince === province.name ? 'is-selected' : ''}`} tabIndex={0} role="button" aria-label={`${province.name}${province.price === undefined ? ', sin datos disponibles' : `, ${euro.format(province.price)} por litro`}`} onClick={() => setSelectedProvince(province.name)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProvince(province.name); }}><title>{province.name}{province.price === undefined ? ' · Sin datos disponibles' : ` · ${euro.format(province.price)}/l`}</title></path>;

    return (
        <>
            <section className="hero" id="precios">
                <div className="hero-copy">
                    <div className="eyebrow"><span className="live-dot" /> DATOS ABIERTOS · ESPAÑA</div>
                    <h1>El precio real.<br /><em>Sin letra pequeña.</em></h1>
                    <p>Consulta los precios de gasóleo C publicados por estaciones terrestres y sigue su evolución en todo el país.</p>
                </div>
                <div className="national-card">
                    <div className="card-topline"><span>MEDIA NACIONAL</span><span className="source-tag"><i /> Geoportal oficial</span></div>
                    <div className="national-price">{nationalAverage ? euro.format(nationalAverage.price) : '—'}<small>/ litro</small></div>
                    <div className="national-meta">
                        <div><span>Última consulta</span><strong>{nationalAverage ? formatDate(nationalAverage.retrievedAt) : 'Sin datos todavía'}</strong></div>
                        <div><span>Observaciones válidas</span><strong>{nationalAverage?.observationCount ?? '—'}</strong></div>
                    </div>
                    <p className="data-caveat"><span>i</span> Media de precios publicados por estaciones terrestres. No es una oferta de suministro a domicilio.</p>
                </div>
                <div className="hero-decoration" aria-hidden="true"><span>€/L</span><svg viewBox="0 0 280 130"><path d="M2 106 C30 95, 35 33, 69 61 S102 114 130 74 163 42 191 67 223 85 278 18" /><path d="M2 115 C30 104, 35 42, 69 70 S102 123 130 83 163 51 191 76 223 94 278 27" /></svg></div>
            </section>

            <section className="map-section" aria-labelledby="map-title">
                <div className="section-heading">
                    <div><div className="eyebrow">EL PRECIO, PROVINCIA A PROVINCIA</div><h2 id="map-title">Explora el mapa</h2><p>Selecciona una provincia para consultar su media y sus datos.</p></div>
                    <div className="map-legend"><span><i className="legend-green" /> Por debajo de la media</span><span><i className="legend-red" /> Por encima</span><span><i className="legend-empty" /> Sin datos</span></div>
                </div>
                <div className="map-card">
                    <div className="map-canvas">
                        {mapPaths.length > 0 ? <svg className="province-map" viewBox="0 0 620 430" role="img" aria-label="Mapa interactivo de las provincias de España">
                            {mapPaths.filter((province) => !province.isCanaryProvince).map(renderProvince)}
                            <rect x="12" y="344" width="130" height="77" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" aria-hidden="true" />
                            {mapPaths.filter((province) => province.isCanaryProvince).map(renderProvince)}
                        </svg> : <div className="map-loading" role="status"><span className="map-spinner" />{mapError ? 'No se ha podido cargar el mapa provincial.' : 'Cargando límites provinciales…'}</div>}
                        <div className="map-attribution">Límites provinciales · <a href="https://github.com/codeforgermany/click_that_hood" target="_blank" rel="noreferrer">Click That ’Hood</a></div>
                    </div>
                    <aside className="province-detail" aria-live="polite">
                        <div className="detail-kicker">{selectedProvince ? 'PROVINCIA SELECCIONADA' : 'DETALLE PROVINCIAL'}</div>
                        <h3>{selectedProvince ?? 'Selecciona una provincia'}</h3>
                        {selectedProvince ? (
                            selectedAverage ? <>
                                <strong className="detail-price">{euro.format(selectedAverage.price)}<small> / litro</small></strong>
                                <dl><div><dt>Última consulta</dt><dd>{formatDate(selectedAverage.retrievedAt)}</dd></div><div><dt>Observaciones</dt><dd>{selectedAverage.observationCount}</dd></div></dl>
                            </> : <div className="no-data-note"><span className="detail-icon">—</span><p>No hay datos disponibles para esta provincia.</p><small>No se muestra un precio ni una fecha hasta recibir una consulta válida.</small></div>
                        ) : <div className="detail-placeholder"><span className="pointer-icon">⌖</span><p>Elige una provincia en el mapa para ver su precio medio y el número de observaciones.</p></div>}
                        {selectedProvince && <button className="clear-selection" onClick={() => setSelectedProvince(null)}>Ver media nacional <span>→</span></button>}
                    </aside>
                </div>
                <p className="map-method">Los colores comparan cada media provincial con la nacional. Los datos antiguos pierden contraste; una provincia sin observaciones permanece diferenciada.</p>
            </section>

            <section className="history-section" id="historial" aria-labelledby="history-title">
                <div className="section-heading history-heading"><div><div className="eyebrow">SEGUIMIENTO EN EL TIEMPO</div><h2 id="history-title">{chartTitle}</h2><p>Precios medios por fecha de consulta.</p></div><span className="period-pill">Histórico disponible</span></div>
                <div className="history-card">
                    {history.length ? <div className="history-chart" aria-label={chartTitle}>{history.map((point, index) => <div className="chart-point" key={`${point.date}-${index}`}><span>{point.price === null ? 'Sin observación' : euro.format(point.price)}</span><i style={{ height: point.price === null ? '0%' : `${Math.max(8, (point.price / Math.max(...history.flatMap((entry) => entry.price === null ? [] : [entry.price]))) * 70)}%` }} /><small>{shortDate.format(new Date(point.date))}</small></div>)}</div> : <div className="history-empty"><div className="empty-chart-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 25V7m0 18h24M8 20l6-7 5 4 8-9" /></svg></div><strong>Aún no hay historial de precios</strong><p>Cuando se recopilen consultas válidas, aquí podrás ver cómo evoluciona la media {selectedProvince ? `de ${selectedProvince}` : 'nacional'}.</p><span>Los días sin observaciones se mostrarán como interrupciones, sin interpolar valores.</span></div>}
                </div>
            </section>

            <section className="observations-section" aria-labelledby="observations-title">
                <div className="section-heading history-heading"><div><div className="eyebrow">DATOS DE ORIGEN</div><h2 id="observations-title">Últimas observaciones</h2><p>Precios publicados por estaciones terrestres.</p></div><span className="row-count">{observations.length} registros</span></div>
                <div className="observations-card">
                    {observations.length ? <div className="table-scroll"><table><thead><tr><th>Estación</th><th>Provincia</th><th>Precio publicado</th><th>Fecha de origen</th><th>Recuperado</th></tr></thead><tbody>{observations.map((observation) => <tr key={observation.id}><td>{observation.station}</td><td>{observation.province}</td><td>{euro.format(observation.price)} / l</td><td>{observation.sourceDate ? formatDate(observation.sourceDate) : 'No indicada'}</td><td>{formatDate(observation.retrievedAt)}</td></tr>)}</tbody></table></div> : <div className="observations-empty"><span className="observation-symbol">◷</span><div><strong>Esperando la primera consulta</strong><p>Las observaciones aparecerán aquí con su estación, provincia y fechas de origen y recuperación.</p></div></div>}
                    <div className="observations-note"><span>i</span> Son precios publicados por estaciones terrestres, no cotizaciones ni precios garantizados de reparto a domicilio.</div>
                </div>
            </section>

            <section className="alert-banner" id="alertas"><div className="alert-art" aria-hidden="true">↘</div><div><div className="eyebrow">NO HACE FALTA ESTAR PENDIENTE</div><h2>Que el precio te avise.</h2><p>Estamos preparando las alertas por correo para que puedas seguir el gasóleo C sin consultar la web cada día.</p></div><span className="coming-soon">PRÓXIMAMENTE</span></section>
        </>
    );
}
