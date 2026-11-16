import type { Theme } from '../types';
import { useTranslation } from '../i18n';
import { LogoConcepts } from './LogoConcepts';
import '../styles/components/Header.css';

type HeaderProps = {
    theme: Theme;
    toggleTheme: () => void;
};

export function Header({ theme, toggleTheme }: HeaderProps) {
    const { t } = useTranslation();
    const themeLabel = t('theme.changeTo', { theme: t(theme === 'dark' ? 'theme.light' : 'theme.dark') });
    return (
        <header className="topbar">
            <a className="brand" href="#/inicio" aria-label={t('navigation.brandHome')}>
                <LogoConcepts />
                <span><strong>gas<span>es</span></strong><small>{t('header.observatory')}</small></span>
            </a>
            <div className="header-actions">
                <a className="alert-link" href="#/inicio#alertas"><span>＋</span> {t('navigation.createAlert')}</a>
                <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
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
