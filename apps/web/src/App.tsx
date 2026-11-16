import { useEffect, useState } from 'react';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { InformationPage } from './pages/InformationPage';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import type { Page, Theme } from './types';

const THEME_STORAGE_KEY = 'gases-theme';

function getStoredTheme(): Theme | null {
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : null;
  } catch {
    return null;
  }
}

function getInitialTheme(): Theme {
  return getStoredTheme() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function getCurrentPage(): Page {
  const route = window.location.hash.slice(2).split('#')[0];
  return route === 'informacion' || route === 'sobre' ? route : 'inicio';
}

export function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [page, setPage] = useState<Page>(getCurrentPage);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#131a16' : '#f7f8f5');
  }, [theme]);

  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = (event: MediaQueryListEvent) => {
      if (getStoredTheme() === null) setTheme(event.matches ? 'dark' : 'light');
    };
    systemTheme.addEventListener('change', syncSystemTheme);
    return () => systemTheme.removeEventListener('change', syncSystemTheme);
  }, []);

  useEffect(() => {
    const syncPage = () => setPage(getCurrentPage());
    window.addEventListener('hashchange', syncPage);
    return () => window.removeEventListener('hashchange', syncPage);
  }, []);

  function navigate(nextPage: Page) {
    setPage(nextPage);
    window.location.hash = `/${nextPage}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Keep theme switching available for the current session if storage is unavailable.
    }
    setTheme(nextTheme);
  }

  return (
    <div className="page-shell">
      <Header theme={theme} toggleTheme={toggleTheme} />
      <main>
        {page === 'inicio' ? <HomePage theme={theme} /> : page === 'informacion' ? <InformationPage /> : <AboutPage />}
      </main>
      <Footer navigate={navigate} />
    </div>
  );
}
