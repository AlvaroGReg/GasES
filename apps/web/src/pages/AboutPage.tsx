import { useTranslation } from '../i18n';
import '../styles/pages/content-page.css';
import '../styles/pages/AboutPage.css';

export function AboutPage() {
    const { t } = useTranslation();
    return (
        <article className="content-page about-page">
            <div className="eyebrow">{t('about.eyebrow')}</div>
            <h1>{t('about.titleFirst')}<br /><em>{t('about.titleSecond')}</em></h1>
            <p className="content-lead">{t('about.intro')}</p>
            <div className="about-repository">
                <div className="github-mark" aria-hidden="true">GH</div>
                <div><span className="detail-kicker">{t('about.openSource')}</span><h2>{t('about.githubTitle')}</h2><p>{t('about.githubDescription')}</p></div>
                <a className="repository-link" href="https://github.com/AlvaroGReg/GasES" target="_blank" rel="noreferrer">{t('about.repository')} <span>↗</span></a>
            </div>
        </article>
    );
}
