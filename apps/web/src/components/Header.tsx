import type { MouseEvent } from 'react';
import type { Theme } from '../types/app';
import { AVAILABLE_LOCALES, useTranslation, type Locale } from '../i18n';
import { LogoConcepts } from './LogoConcepts';
import '../styles/components/Header.css';

type HeaderProps = {
    theme: Theme;
    toggleTheme: () => void;
};

export function Header({ theme, toggleTheme }: HeaderProps) {
    const { locale, setLocale, t } = useTranslation();
    const themeLabel = t('theme.changeTo', { theme: t(theme === 'dark' ? 'theme.light' : 'theme.dark') });
    const localeNames: Record<Locale, string> = {
        es: t('language.es'),
        gl: t('language.gl'),
        eu: t('language.eu'),
        ca: t('language.ca'),
    };

    function selectLocale(nextLocale: Locale, event: MouseEvent<HTMLButtonElement>) {
        setLocale(nextLocale);
        const picker = event.currentTarget.closest('details');
        if (picker) picker.open = false;
    }

    return (
        <header className="topbar">
            <a className="brand" href="#/inicio" aria-label={t('navigation.brandHome')}>
                <LogoConcepts />
                <span><strong>gas<span>es</span></strong><small>{t('header.observatory')}</small></span>
            </a>
            <div className="header-actions">
                <a className="alert-link" href="#/inicio#alertas"><span>＋</span> {t('navigation.createAlert')}</a>
                <details className="language-picker">
                    <summary aria-label={t('language.select')} title={t('language.select')}>
                        <Flag locale={locale} />
                    </summary>
                    <div className="language-menu">
                        {AVAILABLE_LOCALES.map((option) => (
                            <button
                                key={option}
                                type="button"
                                aria-label={localeNames[option]}
                                aria-pressed={locale === option}
                                title={localeNames[option]}
                                onClick={(event) => selectLocale(option, event)}
                            >
                                <Flag locale={option} />
                            </button>
                        ))}
                    </div>
                </details>
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

function Flag({ locale }: { locale: Locale }) {
    if (locale === 'es') {
        return <svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#aa151b" d="M0 0h24v16H0z" /><path fill="#f1bf00" d="M0 4h24v8H0z" /></svg>;
    }
    if (locale === 'gl') {
        return <svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#fff" d="M0 0h24v16H0z" /><path fill="#1685ca" d="M3 0h5l13 16h-5z" /></svg>;
    }
    if (locale === 'eu') {
        return <svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#d52b1e" d="M0 0h24v16H0z" /><path fill="#009b48" d="M0 0h24v4H0zm0 12h24v4H0z" /><path fill="#fff" d="m0 0 24 16m0-16L0 16" stroke="#fff" strokeWidth="3" /><path d="m0 0 24 16m0-16L0 16" stroke="#009b48" strokeWidth="1.3" /></svg>;
    }
    return <svg viewBox="0 0 24 16" aria-hidden="true"><path fill="#fdd835" d="M0 0h24v16H0z" /><path stroke="#da121a" strokeWidth="1.4" d="M0 2h24M0 5h24M0 8h24M0 11h24M0 14h24" /></svg>;
}
