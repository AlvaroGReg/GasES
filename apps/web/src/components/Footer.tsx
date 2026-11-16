import type { Page } from '../types';
import { useTranslation } from '../i18n';

type FooterProps = { navigate: (page: Page) => void };

export function Footer({ navigate }: FooterProps) {
    const { t } = useTranslation();
    return (
        <footer className="site-footer">
            <div className="footer-brand">
                <a className="brand" href="#/inicio" onClick={() => navigate('inicio')}>
                    <span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4v14m0 0 7-7m-7 7-7-7M7 22v5h18v-5" /></svg></span>
                    <span><strong>calor<span>justo</span></strong><small>{t('footer.tagline')}</small></span>
                </a>
                <p>{t('footer.description')}</p>
            </div>
            <div className="footer-links">
                <div>
                    <strong>{t('footer.explore')}</strong>
                    <a href="#/inicio" onClick={() => navigate('inicio')}>{t('navigation.home')}</a>
                    <a href="#/informacion" onClick={() => navigate('informacion')}>{t('navigation.information')}</a>
                    <a href="#/sobre" onClick={() => navigate('sobre')}>{t('navigation.about')}</a>
                </div>
                <div>
                    <strong>{t('footer.publicSource')}</strong>
                    <a href="https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help" target="_blank" rel="noreferrer">{t('footer.api')}</a>
                    <span>{t('footer.ministry')}</span>
                </div>
            </div>
            <div className="footer-bottom">
                <span>© {new Date().getFullYear()} Calorjusto</span>
                <span>{t('footer.disclaimer')}</span>
            </div>
        </footer>
    );
}
