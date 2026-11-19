import type { HomeHeroSectionProps } from '../../types/prices';
import { useTranslation } from '../../i18n';
import '../../styles/components/home/HomeHeroSection.css';

export function HomeHeroSection({
    nationalAverage,
    euro,
    formatDate,
    formatDateTime,
    dataLoading,
    dataError,
}: HomeHeroSectionProps) {
    const { t } = useTranslation();

    return (
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
    );
}
