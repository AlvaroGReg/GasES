import { useMemo } from 'react';
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { useTranslation } from '../../i18n';
import type { HomeMapSectionProps, MapPath } from '../../types/province-map';
import { canonicalProvinceName, getProvinceName, normalizeProvinceName } from '../../utils/provinces';
import '../../styles/components/home/HomeMapSection.css';

const canaryProvinces = new Set(['Las Palmas', 'Santa Cruz de Tenerife']);

function sourceDateKey(date: string): number {
    return Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
}

export function HomeMapSection({
    geoJson,
    mapError,
    provinces,
    nationalAverage,
    theme,
    selectedProvince,
    selectedProvinceName,
    selectedAverage,
    euro,
    formatDate,
    formatDateTime,
    onSelectProvince,
    onClearSelection,
}: HomeMapSectionProps) {
    const { t } = useTranslation();
    const mapPaths = useMemo((): MapPath[] => {
        if (!geoJson) return [];

        const provincesById = new Map(provinces.map((province) => [province.provinceId, province]));
        const provinceIdsByName = new Map(
            provinces.map((province) => [normalizeProvinceName(canonicalProvinceName(province.province)), province.provinceId]),
        );
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
            const isCanaryProvince = canaryProvinces.has(name);
            const reference = provinceId ? provincesById.get(provinceId) : undefined;
            const difference = reference && nationalAverage ? reference.price - nationalAverage.price : 0;
            const intensity = Math.min(Math.abs(difference) / 0.25, 1);
            const ageDays = reference ? Math.max(0, (Date.now() - sourceDateKey(reference.dataDate)) / 86_400_000) : 0;
            const freshness = reference ? Math.max(0, 1 - ageDays / 90) : 0;
            const base = reference && nationalAverage
                ? difference < 0
                    ? `rgba(60, 139, 101, ${0.18 + intensity * 0.62})`
                    : difference > 0
                        ? `rgba(206, 97, 82, ${0.18 + intensity * 0.62})`
                        : '#fff'
                : theme === 'dark' ? '#303a33' : '#edf0ec';
            const fill = reference && freshness < 1
                ? `color-mix(in srgb, ${base} ${Math.round(freshness * 100)}%, #b9c1bb)`
                : base;

            return {
                key: `${provinceId ?? name}-${index}`,
                name,
                provinceId,
                d: (isCanaryProvince ? canaryPath : mainlandPath)(feature as GeoPermissibleObjects) ?? '',
                fill,
                price: reference?.price,
                isCanaryProvince,
            };
        });
    }, [geoJson, nationalAverage, provinces, theme]);

    const renderProvince = (province: MapPath) => {
        const isSelected = selectedProvinceName === province.name;
        const label = province.price === undefined ? t('home.noData') : `${euro.format(province.price)} ${t('home.perLitre')}`;
        const selectProvince = () => onSelectProvince(province.provinceId ?? null, province.name);

        return (
            <path
                key={province.key}
                d={province.d}
                fill={province.fill}
                className={`province-shape ${isSelected ? 'is-selected' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${province.name}, ${label}`}
                aria-pressed={isSelected}
                onClick={selectProvince}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectProvince();
                    }
                }}
            >
                <title>{province.name} · {label}</title>
            </path>
        );
    };

    return (
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
                    {selectedProvince ? <>
                        <div className="detail-kicker">{t('home.selectedProvince')}</div>
                        <h3>{selectedProvince.name}</h3>
                        {selectedAverage ? <>
                            <strong className="detail-price">{euro.format(selectedAverage.price)}<small> {t('home.perLitre')}</small></strong>
                            <dl>
                                <div><dt>{t('home.sourceDate')}</dt><dd>{formatDate(selectedAverage.sourceDate)}</dd></div>
                                <div><dt>{t('home.retrieved')}</dt><dd>{formatDateTime(selectedAverage.retrievedAt)}</dd></div>
                                <div><dt>{t('home.observations')}</dt><dd>{selectedAverage.observationCount}</dd></div>
                            </dl>
                        </> : <div className="no-data-note"><span className="detail-icon">—</span><p>{t('home.provinceNoData')}</p><small>{t('home.noPriceDate')}</small></div>}
                    </> : <>
                        <div className="detail-kicker">{t('home.nationalAverage')}</div>
                        <h3>{t('home.nationalHistory')}</h3>
                        {nationalAverage ? <>
                            <strong className="detail-price">{euro.format(nationalAverage.price)}<small> {t('home.perLitre')}</small></strong>
                            <dl>
                                <div><dt>{t('home.contributingProvinces')}</dt><dd>{nationalAverage.provinceCount}</dd></div>
                                <div><dt>{t('home.validObservations')}</dt><dd>{nationalAverage.stationObservationCount}</dd></div>
                                <div><dt>{t('home.sourceDateRange')}</dt><dd>{formatDate(nationalAverage.dataDateFrom)} – {formatDate(nationalAverage.dataDateTo)}</dd></div>
                            </dl>
                        </> : <div className="no-data-note"><span className="detail-icon">—</span><p>{t('home.noDataYet')}</p></div>}
                    </>}
                    {selectedProvince && <button className="clear-selection" onClick={onClearSelection}>{t('home.showNationalAverage')} <span>→</span></button>}
                </aside>
            </div>
            <p className="map-method">{t('home.mapMethod')}</p>
        </section>
    );
}
