import type { Theme } from '../types';

type HeaderProps = {
    theme: Theme;
    toggleTheme: () => void;
};

export function Header({ theme, toggleTheme }: HeaderProps) {
    return (
        <header className="topbar">
            <a className="brand" href="#/inicio" aria-label="Calorjusto, inicio">
                <span className="brand-icon" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4v14m0 0 7-7m-7 7-7-7M7 22v5h18v-5" /></svg></span>
                <span><strong>calor<span>justo</span></strong><small>OBSERVATORIO DE GASÓLEO C</small></span>
            </a>
            <div className="header-actions">
                <a className="alert-link" href="#/inicio#alertas"><span>＋</span> Crear alerta</a>
                <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`} title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}>
                    {theme === 'dark' ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" /></svg>
                    )}
                </button>
            </div>
        </header>
    );
}
