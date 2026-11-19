import { useEffect, useMemo, useState } from 'react';
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import type { Theme } from '../types';
import { useTranslation } from '../i18n';
import '../styles/pages/HomePage.css';

type ProvinceGeometry = {
    type: 'Feature';
    properties: Record<string, string>;
    geometry: { type: 'MultiPolygon'; coordinates: number[][][][] };
};
type GeoJson = { type: 'FeatureCollection'; features: ProvinceGeometry[] };
type NationalReference = {
    price: number;
    provinceCount: number;
    stationObservationCount: number;
    dataDateFrom: string;
    dataDateTo: string;
    retrievedAtFrom: string;
    retrievedAtTo: string;
    calculatedAt: string;
};
type ProvincialReference = {
    provinceId: string;
    province: string;
    price: number;
    observationCount: number;
    dataDate: string;
    sourceDate: string;
    retrievedAt: string;
};
type LatestResponse = { national: NationalReference | null; provinces: ProvincialReference[] };
type NationalHistoryPoint = {
    date: string;
    price: number;
    provinceCount: number;
    stationObservationCount: number;
    dataDateFrom: string;
    dataDateTo: string;
    retrievedAtFrom: string;
    retrievedAtTo: string;
};
type ProvincialHistoryPoint = {
    date: string;
    price: number;
    observationCount: number;
    sourceDate: string;
    retrievedAt: string;
};
type HistoryPoint = NationalHistoryPoint | ProvincialHistoryPoint;
type Observation = {
    stationId: string | null;
    brand: string | null;
    locality: string | null;
    municipality: string | null;
    provinceId: string | null;
    province: string | null;
    price: number;
    sourceDate: string;
    retrievedAt: string;
};
type Period = '1y' | '6m' | '3m' | '1m';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const PERIODS: Period[] = ['1y', '6m', '3m', '1m'];
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

function canonicalProvinceName(name: string): string {
    return provinceAliases.get(normalizeProvinceName(name)) ?? name.trim();
}

function getProvinceName(feature: ProvinceGeometry): string {
    const properties = feature.properties;
    return canonicalProvinceName(properties.name ?? properties.NAME_2 ?? properties.provincia ?? properties.NAME ?? '');
}

function parseSourceDate(value: string): Date {
    const match = /^(\d{2})[-/](\d{2})[-/](\d{4})/.exec(value);
    return match
        ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])))
        : new Date(value);
}

function dateKey(date: string): number {
    return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

function dayDistance(first: string, second: string): number {
    return Math.round((dateKey(second) - dateKey(first)) / 86_400_000);
}

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
}

type HomePageProps = { theme: Theme };

export function HomePage({ theme }: HomePageProps) {
    const { t, formatLocale } = useTranslation();
    const euro = useMemo(() => new Intl.NumberFormat(formatLocale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }), [formatLocale]);
    const dateFormat = useMemo(() => new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }), [formatLocale]);
    const dateTimeFormat = useMemo(() => new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), [formatLocale]);
    const shortDate = useMemo(() => new Intl.DateTimeFormat(formatLocale, { day: 'numeric', month: 'short', timeZone: 'UTC' }), [formatLocale]);
    const formatDate = (value: string) => dateFormat.format(parseSourceDate(value));
    const formatDateTime = (value: string) => dateTimeFormat.format(new Date(value));

    const [geoJson, setGeoJson] = useState<GeoJson | null>(null);
    const [mapError, setMapError] = useState(false);
    const [latest, setLatest] = useState<LatestResponse | null>(null);
    const [observations, setObservations] = useState<Observation[]>([]);
    const [history, setHistory] = useState<HistoryPoint[]>([]);
    const [period, setPeriod] = useState<Period>('1y');
    const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
    const [selectedProvinceName, setSelectedProvinceName] = useState<string | null>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState(false);
    const [observationsError, setObservationsError] = useState(false);

    useEffect(() => {
        if (selectedProvinceName && !selectedProvinceId) {
            setHistory([]);
            setHistoryLoading(false);
            setHistoryError(false);
            return;
        }
        const controller = new AbortController();
        fetch('/data/spain-provinces.geojson', { signal: controller.signal })
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<GeoJson>;
            })
            .then(setGeoJson)
            .catch((error: unknown) => {
                if (error instanceof Error && error.name !== 'AbortError') setMapError(true);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        setDataLoading(true);
        setDataError(false);
        Promise.allSettled([
            fetchJson<LatestResponse>('/prices/latest', controller.signal),
            fetchJson<Observation[]>('/prices/observations', controller.signal),
        ]).then(([latestResult, observationsResult]) => {
            if (latestResult.status === 'fulfilled') {
                setLatest(latestResult.value);
            } else if (!(latestResult.reason instanceof Error && latestResult.reason.name === 'AbortError')) {
                setDataError(true);
            }
            if (observationsResult.status === 'fulfilled') {
                setObservations(observationsResult.value);
            } else if (!(observationsResult.reason instanceof Error && observationsResult.reason.name === 'AbortError')) {
                setObservationsError(true);
            }
        }).finally(() => {
            if (!controller.signal.aborted) setDataLoading(false);
        });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        const provinceQuery = selectedProvinceId ? `&provinceId=${encodeURIComponent(selectedProvinceId)}` : '';
        setHistoryLoading(true);
        setHistoryError(false);
        fetchJson<HistoryPoint[]>(`/prices/history?period=${period}${provinceQuery}`, controller.signal)
            .then(setHistory)
            .catch((error: unknown) => {
                if (error instanceof Error && error.name !== 'AbortError') {
                    setHistory([]);
                    setHistoryError(true);
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setHistoryLoading(false);
            });
        return () => controller.abort();
    }, [period, selectedProvinceId, selectedProvinceName]);

    const provinces = latest?.provinces ?? [];
    const provincesById = useMemo(() => new Map(provinces.map((province) => [province.provinceId, province])), [provinces]);
    const provinceIdsByName = useMemo(
        () => new Map(provinces.map((province) => [normalizeProvinceName(canonicalProvinceName(province.province)), province.provinceId])),
        [provinces],
    );
    const selectedProvince = selectedProvinceName
        ? { id: selectedProvinceId, name: selectedProvinceName }
        : geoJson?.features
            .map((feature) => ({ id: provinceIdsByName.get(normalizeProvinceName(getProvinceName(feature))), name: getProvinceName(feature) }))
            .find((province) => province.id === selectedProvinceId);
    const selectedAverage = selectedProvinceId ? provincesById.get(selectedProvinceId) : undefined;
    const nationalAverage = latest?.national ?? null;
    const chartTitle = selectedProvince ? t('home.provinceHistory', { province: selectedProvince.name }) : t('home.nationalHistory');

    const mapPaths = useMemo(() => {
        if (!geoJson) return [];
        const features = geoJson.features.map((feature) => {
            const name = getProvinceName(feature);
            return { feature, name, provinceId: provinceIdsByName.get(normalizeProvinceName(name)) };
        });
        const mainlandFeatures = features.filter(({ name }) => !canaryProvinces.has(name));
        const canaryFeatures = features.filter(({ name }) => canaryProvinces.has(name));
        const mainlandProjection = geoMercator().fitExtent([[150, 14], [610, 416]], {
            type: 'FeatureCollection',
            features: mainlandFeatures.map(({ feature }) => feature),
        } as unknown as GeoPermissibleObjects);
        const canaryProjection = geoMercator().fitExtent([[22, 354], [132, 411]], {
            type: 'FeatureCollection',
            features: canaryFeatures.map(({ feature }) => feature),
        } as unknown as GeoPermissibleObjects);
        const mainlandPath = geoPath(mainlandProjection);
        const canaryPath = geoPath(canaryProjection);
        return features.map(({ feature, name, provinceId }, index) => {
            const isCanary = canaryProvinces.has(name);
            const reference = provinceId ? provincesById.get(provinceId) : undefined;
            const difference = reference && nationalAverage ? reference.price - nationalAverage.price : 0;
            const intensity = Math.min(Math.abs(difference) / 0.25, 1);
            const ageDays = reference ? Math.max(0, (Date.now() - dateKey(reference.dataDate)) / 86_400_000) : 0;
            const freshness = reference ? Math.max(0, 1 - ageDays / 90) : 0;
            const base = reference && nationalAverage
                ? difference < 0 ? `rgba(60, 139, 101, ${0.18 + intensity * 0.62})` : difference > 0 ? `rgba(206, 97, 82, ${0.18 + intensity * 0.62})` : '#fff'
                : theme === 'dark' ? '#303a33' : '#edf0ec';
            const faded = reference && freshness < 1 ? `color-mix(in srgb, ${base} ${Math.round(freshness * 100)}%, #b9c1bb)` : base;
            return {
                key: `${provinceId ?? name}-${index}`,
                name,
                provinceId,
                d: (isCanary ? canaryPath : mainlandPath)(feature as GeoPermissibleObjects) ?? '',
                fill: faded,
                price: reference?.price,
                isCanaryProvince: isCanary,
            };
        });
    }, [geoJson, nationalAverage, provinceIdsByName, provincesById, theme]);

    const chartPoints = useMemo(() => {
        if (!history.length) return [];
        const prices = history.map((point) => point.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const range = maxPrice - minPrice || Math.max(maxPrice * 0.02, 0.01);
        const start = dateKey(history[0].date);
        const end = dateKey(history[history.length - 1].date);
        const span = Math.max(1, (end - start) / 86_400_000);
        return history.map((point, index) => ({
            point,
            x: 8 + ((dateKey(point.date) - start) / 86_400_000 / span) * 984,
            y: 166 - ((point.price - minPrice) / range) * 132,
            previous: index > 0 ? history[index - 1] : undefined,
        }));
    }, [history]);

    const renderProvince = (province: (typeof mapPaths)[number]) => {
        const label = province.price === undefined ? t('home.noData') : `${euro.format(province.price)} ${t('home.perLitre')}`;
        return (
            <path
                key={province.key}
                d={province.d}
                fill={province.fill}
                className={`province-shape ${selectedProvinceName === province.name ? 'is-selected' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${province.name}, ${label}`}
                aria-pressed={selectedProvinceName === province.name}
                onClick={() => {
                    setSelectedProvinceName(province.name);
                    setSelectedProvinceId(province.provinceId ?? null);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedProvinceName(province.name);
                        setSelectedProvinceId(province.provinceId ?? null);
                    }
                }}
            >
                <title>{province.name} · {label}</title>
            </path>
        );
    };

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
                        <div><span>{t('home.sourceDateRange')}</span><strong>{nationalAverage ? `${formatDate(nationalAverage.dataDateFrom)} – ${formatDate(nationalAverage.dataDateTo)}` : t('home.noDataYet')}</strong></div>
                        <div><span>{t('home.contributingProvinces')}</span><strong>{nationalAverage?.provinceCount ?? '—'}</strong></div>
                        <div><span>{t('home.validObservations')}</span><strong>{nationalAverage?.stationObservationCount ?? '—'}</strong></div>
                        <div><span>{t('home.retrievedRange')}</span><strong>{nationalAverage ? `${formatDateTime(nationalAverage.retrievedAtFrom)} – ${formatDateTime(nationalAverage.retrievedAtTo)}` : '—'}</strong></div>
                    </div>
                    {dataLoading && <p className="data-status" role="status">{t('home.loadingPrices')}</p>}
                    {dataError && <p className="data-status is-error" role="alert">{t('home.dataLoadError')}</p>}
                    <p className="data-caveat"><span>i</span> {t('home.nationalDisclaimer')}</p>
                </div>
                <div className="hero-decoration" aria-hidden="true"><span>€/L</span><svg viewBox="0 0 280 130"><path d="M2 106 C30 95, 35 33, 69 61 S102 114 130 74 163 42 191 67 223 85 278 18" /><path d="M2 115 C30 104, 35 42, 69 70 S102 123 130 83 163 51 191 76 223 94 278 27" /></svg></div>
            </section>

            <section className="map-section" aria-labelledby="map-title">
                <div className="section-heading">
                    <div><div className="eyebrow">{t('home.mapEyebrow')}</div><h2 id="map-title">{t('home.mapTitle')}</h2><p>{t('home.mapIntro')}</p></div>
                    <div className="map-legend"><span><i className="legend-green" /> {t('home.belowAverage')}</span><span><i className="legend-red" /> {t('home.aboveAverage')}</span><span><i className="legend-empty" /> {t('home.noData')}</span><span className="map-legend-note">{t('home.mapFreshnessNotice')}</span></div>
                </div>
                <div className="map-card">
                    <div className="map-canvas">
                        {mapPaths.length > 0 ? <svg className="province-map" viewBox="0 0 620 430" role="group" aria-label={t('home.mapAria')}>
                            {mapPaths.filter((province) => !province.isCanaryProvince).map(renderProvince)}
                            <rect x="12" y="344" width="130" height="77" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" aria-hidden="true" />
                            {mapPaths.filter((province) => province.isCanaryProvince).map(renderProvince)}
                        </svg> : <div className="map-loading" role={mapError ? 'alert' : 'status'}>{mapError ? t('home.mapLoadError') : t('home.mapLoading')}</div>}
                        <div className="map-attribution">{t('home.mapAttribution')} <a href="https://github.com/codeforgermany/click_that_hood" target="_blank" rel="noreferrer">Click That ’Hood</a></div>
                    </div>
                    <aside className="province-detail" aria-live="polite">
                        <div className="detail-kicker">{selectedProvince ? t('home.selectedProvince') : t('home.provincialDetail')}</div>
                        <h3>{selectedProvince?.name ?? t('home.selectProvince')}</h3>
                        {selectedProvince ? (
                            selectedAverage ? <>
                                <strong className="detail-price">{euro.format(selectedAverage.price)}<small> {t('home.perLitre')}</small></strong>
                                <dl>
                                    <div><dt>{t('home.sourceDate')}</dt><dd>{formatDate(selectedAverage.sourceDate)}</dd></div>
                                    <div><dt>{t('home.retrieved')}</dt><dd>{formatDateTime(selectedAverage.retrievedAt)}</dd></div>
                                    <div><dt>{t('home.observations')}</dt><dd>{selectedAverage.observationCount}</dd></div>
                                </dl>
                            </> : <div className="no-data-note"><span className="detail-icon">—</span><p>{t('home.provinceNoData')}</p><small>{t('home.noPriceDate')}</small></div>
                        ) : <div className="detail-placeholder"><span className="pointer-icon">⌖</span><p>{t('home.provincePrompt')}</p></div>}
                        {selectedProvince && <button className="clear-selection" onClick={() => {
                            setSelectedProvinceName(null);
                            setSelectedProvinceId(null);
                        }}>{t('home.showNationalAverage')} <span>→</span></button>}
                    </aside>
                </div>
                <p className="map-method">{t('home.mapMethod')}</p>
            </section>

            <section className="history-section" id="historial" aria-labelledby="history-title">
                <div className="section-heading history-heading">
                    <div><div className="eyebrow">{t('home.historyEyebrow')}</div><h2 id="history-title">{chartTitle}</h2><p>{t('home.historyIntro')}</p></div>
                    <div className="period-controls" aria-label={t('home.historyPeriods')}>
                        {PERIODS.map((value) => <button key={value} type="button" className={period === value ? 'is-active' : ''} aria-pressed={period === value} onClick={() => setPeriod(value)}>{t(`home.period.${value}`)}</button>)}
                    </div>
                </div>
                <div className="history-card">
                    {historyLoading ? <div className="history-empty" role="status">{t('home.loadingHistory')}</div>
                        : historyError ? <div className="history-empty" role="alert"><strong>{t('home.historyErrorTitle')}</strong><p>{t('home.dataLoadError')}</p></div>
                            : history.length ? <>
                                <div className="history-chart" role="img" aria-label={t('home.chartAria', { area: selectedProvince?.name ?? t('home.nationalArea') })}>
                                    <svg viewBox="0 0 1000 190" preserveAspectRatio="none" aria-hidden="true">
                                        {chartPoints.map(({ point, x, y, previous }, index) => {
                                            const joinsPrevious = previous !== undefined && dayDistance(previous.date, point.date) === 1;
                                            const previousEntry = joinsPrevious ? chartPoints[index - 1] : undefined;
                                            return <g key={point.date}>
                                                {previousEntry && <line x1={previousEntry.x} y1={previousEntry.y} x2={x} y2={y} className="chart-line" />}
                                                <circle cx={x} cy={y} r="3" className="chart-dot">
                                                    <title>{'sourceDate' in point
                                                        ? `${formatDate(point.date)} · ${euro.format(point.price)} · ${t('home.sourceDate')}: ${point.sourceDate} · ${t('home.retrieved')}: ${formatDateTime(point.retrievedAt)}`
                                                        : `${formatDate(point.date)} · ${euro.format(point.price)} · ${t('home.sourceDateRange')}: ${formatDate(point.dataDateFrom)} – ${formatDate(point.dataDateTo)} · ${t('home.retrievedRange')}: ${formatDateTime(point.retrievedAtFrom)} – ${formatDateTime(point.retrievedAtTo)}`}</title>
                                                </circle>
                                            </g>;
                                        })}
                                    </svg>
                                    <div className="chart-axis"><span>{formatDate(history[0].date)}</span><span>{formatDate(history[history.length - 1].date)}</span></div>
                                </div>
                                <div className="history-summary"><span>{t('home.historyPointCount', { count: history.length })}</span><span>{t('home.historyHoverHelp')}</span></div>
                            </> : <div className="history-empty"><div className="empty-chart-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 25V7m0 18h24M8 20l6-7 5 4 8-9" /></svg></div><strong>{t('home.historyEmptyTitle')}</strong><p>{t('home.historyEmpty', { area: selectedProvince ? t('home.provinceArea', { province: selectedProvince.name }) : t('home.nationalArea') })}</p><span>{t('home.historyGaps')}</span></div>}
                </div>
            </section>

            <section className="observations-section" aria-labelledby="observations-title">
                <div className="section-heading history-heading"><div><div className="eyebrow">{t('home.sourceEyebrow')}</div><h2 id="observations-title">{t('home.latestObservations')}</h2><p>{t('home.stationPrices')}</p></div><span className="row-count">{t('home.recordCount', { count: observations.length })}</span></div>
                <div className="observations-card">
                    {observationsError ? <div className="observations-empty" role="alert"><div><strong>{t('home.dataLoadError')}</strong></div></div>
                        : observations.length ? <div className="table-scroll"><table><thead><tr><th>{t('home.station')}</th><th>{t('home.province')}</th><th>{t('home.publishedPrice')}</th><th>{t('home.sourceDate')}</th><th>{t('home.retrieved')}</th></tr></thead><tbody>{observations.map((observation, index) => <tr key={`${observation.stationId ?? 'station'}-${index}`}><td>{observation.brand || observation.stationId || t('home.unknownStation')}<small className="station-location">{[observation.locality, observation.municipality].filter(Boolean).join(' · ')}</small></td><td>{observation.province ?? '—'}</td><td>{euro.format(observation.price)} / l</td><td>{formatDate(observation.sourceDate)}</td><td>{formatDateTime(observation.retrievedAt)}</td></tr>)}</tbody></table></div>
                            : <div className="observations-empty"><span className="observation-symbol">◷</span><div><strong>{dataLoading ? t('home.loadingPrices') : t('home.waitingFirstQuery')}</strong><p>{t('home.observationsEmpty')}</p></div></div>}
                    <div className="observations-note"><span>i</span> {t('home.observationsDisclaimer')}</div>
                </div>
            </section>

            <section className="alert-banner" id="alertas"><div className="alert-art" aria-hidden="true">↘</div><div><div className="eyebrow">{t('home.alertEyebrow')}</div><h2>{t('home.alertTitle')}</h2><p>{t('home.alertIntro')}</p></div><span className="coming-soon">{t('home.comingSoon')}</span></section>
        </>
    );
}
