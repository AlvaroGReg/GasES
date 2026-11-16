import type { Page } from '../types';

type FooterProps = { navigate: (page: Page) => void };

export function Footer({ navigate }: FooterProps) {
    return (
        <footer className="site-footer">
            <div className="footer-brand">
                <a className="brand" href="#/inicio" onClick={() => navigate('inicio')}>
                    <span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4v14m0 0 7-7m-7 7-7-7M7 22v5h18v-5" /></svg></span>
                    <span><strong>calor<span>justo</span></strong><small>DATOS PARA DECIDIR MEJOR</small></span>
                </a>
                <p>Un observatorio de precios publicados de gasóleo C en España.</p>
            </div>
            <div className="footer-links">
                <div>
                    <strong>Explora</strong>
                    <a href="#/inicio" onClick={() => navigate('inicio')}>Inicio</a>
                    <a href="#/informacion" onClick={() => navigate('informacion')}>Información</a>
                    <a href="#/sobre" onClick={() => navigate('sobre')}>Sobre nosotros</a>
                </div>
                <div>
                    <strong>Fuente pública</strong>
                    <a href="https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/help" target="_blank" rel="noreferrer">API del Geoportal ↗</a>
                    <span>Ministerio para la Transición Ecológica</span>
                </div>
            </div>
            <div className="footer-bottom">
                <span>© {new Date().getFullYear()} Calorjusto</span>
                <span>Precios publicados por estaciones terrestres; no son cotizaciones de reparto.</span>
            </div>
        </footer>
    );
}
