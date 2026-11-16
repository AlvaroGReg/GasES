import { useEffect, useMemo, useState } from 'react';
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import type { Theme } from '../types';
import { useTranslation } from '../i18n';

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

type HomePageProps = { theme: Theme };

export function HomePage({ theme }: HomePageProps) {
    const { t, formatLocale } = useTranslation();
    const euro = useMemo(() => new Intl.NumberFormat(formatLocale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 3 }), [formatLocale]);
    const dateFormat = useMemo(() => new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'long', year: 'numeric' }), [formatLocale]);
    const shortDate = useMemo(() => new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'short' }), [formatLocale]);
    const formatDate = (date: string) => dateFormat.format(new Date(date));
    const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
    const [mapError, setMapError] = useState(false);
    const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetch('https://raw.githubusercontent.com/codeforgermany/click_that_hood/main/public/data/spain-provinces.geojson', { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error();
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
    const chartTitle = selectedProvince ? t('home.provinceHistory', { province: selectedProvince }) : t('home.nationalHistory');
    const renderProvince = (province: (typeof mapPaths)[number]) => <path key={province.key} d={province.d} fill={province.fill} className={`province-shape ${selectedProvince === province.name ? 'is-selected' : ''}`} tabIndex={0} role="button" aria-label={`${province.name}${province.price === undefined ? `, ${t('home.noData')}` : `, ${euro.format(province.price)} ${t('home.perLitre')}`}`} onClick={() => setSelectedProvince(province.name)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProvince(province.name); }}><title>{province.name}{province.price === undefined ? ` · ${t('home.noData')}` : ` · ${euro.format(province.price)}/l`}</title></path>;

    return (
        <>
            <section className="hero" id="precios">
                <div className="hero-copy">
                    <div className="eyebrow"><span className="live-dot" /> {t('home.eyebrow')}</div>
                    <h1>{t('home.titleFirst')}<br /><em>{t('home.titleSecond')}</em></h1>
                    <p>{t('home.intro')}</p>
                </div>
                <div className="national-card">
                    <div className="card-topline"><span>{t('home.nationalAverage')}</span><span className="source-tag"><i /> {t('home.officialGeoportal')}</span></div>
                    <div className="national-price">{nationalAverage ? euro.format(nationalAverage.price) : '—'}<small>{t('home.perLitre')}</small></div>
                    <div className="national-meta">
                        <div><span>{t('home.lastQuery')}</span><strong>{nationalAverage ? formatDate(nationalAverage.retrievedAt) : t('home.noDataYet')}</strong></div>
                        <div><span>{t('home.validObservations')}</span><strong>{nationalAverage?.observationCount ?? '—'}</strong></div>
                    </div>
                    <p className="data-caveat"><span>i</span> {t('home.nationalDisclaimer')}</p>
                </div>
                <div className="hero-decoration" aria-hidden="true"><span>€/L</span><svg viewBox="0 0 280 130"><path d="M2 106 C30 95, 35 33, 69 61 S102 114 130 74 163 42 191 67 223 85 278 18" /><path d="M2 115 C30 104, 35 42, 69 70 S102 123 130 83 163 51 191 76 223 94 278 27" /></svg></div>
            </section>

            <section className="map-section" aria-labelledby="map-title">
                <div className="section-heading">
                    <div><div className="eyebrow">{t('home.mapEyebrow')}</div><h2 id="map-title">{t('home.mapTitle')}</h2><p>{t('home.mapIntro')}</p></div>
                    <div className="map-legend"><span><i className="legend-green" /> {t('home.belowAverage')}</span><span><i className="legend-red" /> {t('home.aboveAverage')}</span><span><i className="legend-empty" /> {t('home.noData')}</span></div>
                </div>
                <div className="map-card">
                    <div className="map-canvas">
                        {mapPaths.length > 0 ? <svg className="province-map" viewBox="0 0 620 430" role="img" aria-label={t('home.mapAria')}>
                            {mapPaths.filter((province) => !province.isCanaryProvince).map(renderProvince)}
                            <rect x="12" y="344" width="130" height="77" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" aria-hidden="true" />
                            {mapPaths.filter((province) => province.isCanaryProvince).map(renderProvince)}
                        </svg> : <div className="map-loading" role="status"><span className="map-spinner" />{mapError ? t('home.mapLoadError') : t('home.mapLoading')}</div>}
                        <div className="map-attribution">{t('home.mapAttribution')} <a href="https://github.com/codeforgermany/click_that_hood" target="_blank" rel="noreferrer">Click That ’Hood</a></div>
                    </div>
                    <aside className="province-detail" aria-live="polite">
                        <div className="detail-kicker">{selectedProvince ? t('home.selectedProvince') : t('home.provincialDetail')}</div>
                        <h3>{selectedProvince ?? t('home.selectProvince')}</h3>
                        {selectedProvince ? (
                            selectedAverage ? <>
                                <strong className="detail-price">{euro.format(selectedAverage.price)}<small> {t('home.perLitre')}</small></strong>
                                <dl><div><dt>{t('home.lastQuery')}</dt><dd>{formatDate(selectedAverage.retrievedAt)}</dd></div><div><dt>{t('home.observations')}</dt><dd>{selectedAverage.observationCount}</dd></div></dl>
                            </> : <div className="no-data-note"><span className="detail-icon">—</span><p>{t('home.provinceNoData')}</p><small>{t('home.noPriceDate')}</small></div>
                        ) : <div className="detail-placeholder"><span className="pointer-icon">⌖</span><p>{t('home.provincePrompt')}</p></div>}
                        {selectedProvince && <button className="clear-selection" onClick={() => setSelectedProvince(null)}>{t('home.showNationalAverage')} <span>→</span></button>}
                    </aside>
                </div>
                <p className="map-method">{t('home.mapMethod')}</p>
            </section>

            <section className="history-section" id="historial" aria-labelledby="history-title">
                <div className="section-heading history-heading"><div><div className="eyebrow">{t('home.historyEyebrow')}</div><h2 id="history-title">{chartTitle}</h2><p>{t('home.historyIntro')}</p></div><span className="period-pill">{t('home.historyAvailable')}</span></div>
                <div className="history-card">
                    {history.length ? <div className="history-chart" aria-label={chartTitle}>{history.map((point, index) => <div className="chart-point" key={`${point.date}-${index}`}><span>{point.price === null ? t('home.noObservation') : euro.format(point.price)}</span><i style={{ height: point.price === null ? '0%' : `${Math.max(8, (point.price / Math.max(...history.flatMap((entry) => entry.price === null ? [] : [entry.price]))) * 70)}%` }} /><small>{shortDate.format(new Date(point.date))}</small></div>)}</div> : <div className="history-empty"><div className="empty-chart-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 25V7m0 18h24M8 20l6-7 5 4 8-9" /></svg></div><strong>{t('home.historyEmptyTitle')}</strong><p>{t('home.historyEmpty', { area: selectedProvince ? t('home.provinceArea', { province: selectedProvince }) : t('home.nationalArea') })}</p><span>{t('home.historyGaps')}</span></div>}
                </div>
            </section>

            <section className="observations-section" aria-labelledby="observations-title">
                <div className="section-heading history-heading"><div><div className="eyebrow">{t('home.sourceEyebrow')}</div><h2 id="observations-title">{t('home.latestObservations')}</h2><p>{t('home.stationPrices')}</p></div><span className="row-count">{t('home.recordCount', { count: observations.length })}</span></div>
                <div className="observations-card">
                    {observations.length ? <div className="table-scroll"><table><thead><tr><th>{t('home.station')}</th><th>{t('home.province')}</th><th>{t('home.publishedPrice')}</th><th>{t('home.sourceDate')}</th><th>{t('home.retrieved')}</th></tr></thead><tbody>{observations.map((observation) => <tr key={observation.id}><td>{observation.station}</td><td>{observation.province}</td><td>{euro.format(observation.price)} / l</td><td>{observation.sourceDate ? formatDate(observation.sourceDate) : t('home.dateNotProvided')}</td><td>{formatDate(observation.retrievedAt)}</td></tr>)}</tbody></table></div> : <div className="observations-empty"><span className="observation-symbol">◷</span><div><strong>{t('home.waitingFirstQuery')}</strong><p>{t('home.observationsEmpty')}</p></div></div>}
                    <div className="observations-note"><span>i</span> {t('home.observationsDisclaimer')}</div>
                </div>
            </section>

            <section className="alert-banner" id="alertas"><div className="alert-art" aria-hidden="true">↘</div><div><div className="eyebrow">{t('home.alertEyebrow')}</div><h2>{t('home.alertTitle')}</h2><p>{t('home.alertIntro')}</p></div><span className="coming-soon">{t('home.comingSoon')}</span></section>
        </>
    );
}
