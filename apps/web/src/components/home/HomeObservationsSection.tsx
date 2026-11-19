import { useTranslation } from '../../i18n';
import type { HomeObservationsSectionProps } from '../../types/prices';
import '../../styles/components/home/HomeObservationsSection.css';

export function HomeObservationsSection({
    observations,
    observationsError,
    dataLoading,
    euro,
    formatDate,
    formatDateTime,
}: HomeObservationsSectionProps) {
    const { t } = useTranslation();

    return (
        <section className="observations-section" aria-labelledby="observations-title">
            <div className="section-heading history-heading">
                <div><div className="eyebrow">{t('home.sourceEyebrow')}</div><h2 id="observations-title">{t('home.latestObservations')}</h2><p>{t('home.stationPrices')}</p></div>
                <span className="row-count">{t('home.recordCount', { count: observations.length })}</span>
            </div>
            <div className="observations-card">
                {observationsError ? <div className="observations-empty" role="alert"><div><strong>{t('home.dataLoadError')}</strong></div></div>
                    : observations.length ? <div className="table-scroll"><table><thead><tr><th>{t('home.station')}</th><th>{t('home.province')}</th><th>{t('home.publishedPrice')}</th><th>{t('home.sourceDate')}</th><th>{t('home.retrieved')}</th></tr></thead><tbody>{observations.map((observation, index) => <tr key={`${observation.stationId ?? 'station'}-${index}`}><td>{observation.brand || observation.stationId || t('home.unknownStation')}<small className="station-location">{[observation.locality, observation.municipality].filter(Boolean).join(' · ')}</small></td><td>{observation.province ?? '—'}</td><td>{euro.format(observation.price)} / l</td><td>{formatDate(observation.sourceDate)}</td><td>{formatDateTime(observation.retrievedAt)}</td></tr>)}</tbody></table></div>
                        : <div className="observations-empty"><span className="observation-symbol">◷</span><div><strong>{dataLoading ? t('home.loadingPrices') : t('home.waitingFirstQuery')}</strong><p>{t('home.observationsEmpty')}</p></div></div>}
                <div className="observations-note"><span>i</span> {t('home.observationsDisclaimer')}</div>
            </div>
        </section>
    );
}
