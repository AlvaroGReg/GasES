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
                <div className="github-mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 .5C5.65.5.5 5.75.5 12.24c0 5.2 3.35 9.61 8 11.17.59.11.8-.26.8-.58V20.6c-3.26.73-3.95-1.42-3.95-1.42-.54-1.39-1.33-1.76-1.33-1.76-1.09-.76.08-.75.08-.75 1.2.09 1.83 1.26 1.83 1.26 1.07 1.87 2.8 1.33 3.48 1.02.11-.79.42-1.33.76-1.64-2.6-.3-5.33-1.34-5.33-5.96 0-1.32.47-2.4 1.24-3.25-.12-.3-.54-1.54.12-3.21 0 0 1.01-.33 3.3 1.24.96-.27 1.98-.41 3-.42 1.02 0 2.04.15 3 .42 2.29-1.57 3.3-1.24 3.3-1.24.66 1.67.24 2.91.12 3.21.77.85 1.24 1.93 1.24 3.25 0 4.63-2.74 5.65-5.35 5.95.42.37.8 1.1.8 2.22v3.29c0 .32.21.69.8.58 4.65-1.56 8-5.97 8-11.17C23.5 5.75 18.35.5 12 .5Z" />
                    </svg>
                </div>
                <div><span className="detail-kicker">{t('about.openSource')}</span><h2>{t('about.githubTitle')}</h2><p>{t('about.githubDescription')}</p></div>
                <a className="repository-link" href="https://github.com/AlvaroGReg/GasES" target="_blank" rel="noreferrer">{t('about.repository')} <span>↗</span></a>
            </div>
            <div className="about-repository">
                <img className="portfolio-mark" src="logos/logo_pato-v2.png" alt="" />
                <div><span className="detail-kicker">{t('about.portfolio')}</span><h2>{t('about.portfolioTitle')}</h2><p>{t('about.portfolioDescription')}</p></div>
                <a className="repository-link" href="https://alvarogreg.github.io/WebPortfolio/" target="_blank" rel="noreferrer">{t('about.visitPortfolio')} <span>↗</span></a>
            </div>
        </article>
    );
}
