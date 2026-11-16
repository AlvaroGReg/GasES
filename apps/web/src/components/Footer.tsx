import type { Page } from '../types';
import { useTranslation } from '../i18n';
import { LogoConcepts } from './LogoConcepts';
import '../styles/components/Footer.css';

type FooterProps = { navigate: (page: Page) => void };

export function Footer({ navigate }: FooterProps) {
    const { t } = useTranslation();
    return (
        <footer className="site-footer">
            <div className="footer-brand">
                <a className="brand" href="#/inicio" onClick={() => navigate('inicio')}>
                    <LogoConcepts />
                    <span><strong>gas<span>es</span></strong><small>{t('footer.tagline')}</small></span>
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
                <span>© {new Date().getFullYear()} GasEs</span>
                <span>{t('footer.disclaimer')}</span>
            </div>
        </footer>
    );
}
