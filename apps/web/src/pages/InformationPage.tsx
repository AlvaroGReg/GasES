import { useTranslation } from '../i18n';
import '../styles/pages/content-page.css';
import '../styles/pages/InformationPage.css';

export function InformationPage() {
    const { t } = useTranslation();
    return (
        <article className="content-page information-page">
            <div className="eyebrow"><span className="live-dot" /> {t('information.eyebrow')}</div>
            <h1>{t('information.titleFirst')}<br /><em>{t('information.titleSecond')}</em></h1>
            <p className="content-lead">{t('information.intro')}</p>
            <section className="information-card">
                <span className="information-number">01</span>
                <div><h2>{t('information.sourceTitle')}</h2><p>{t('information.sourceDescription')}</p><p>{t('information.processDescription')}</p><a className="text-link" href="https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help" target="_blank" rel="noreferrer">{t('information.apiDocumentation')} <span>↗</span></a></div>
            </section>
            <aside className="information-notice"><span>i</span><p>{t('information.notice')}</p></aside>
        </article>
    );
}
