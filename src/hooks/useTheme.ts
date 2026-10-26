import { useCallback, useEffect, useLayoutEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'legno-co:theme:v1';

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }
}

function applyTheme(theme: Theme) {
  const background = theme === 'dark' ? '#111715' : '#faf9f6';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.style.backgroundColor = background;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  useLayoutEffect(() => applyTheme(theme), [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    // Store only the appearance preference, never the visitor's quote inputs.
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Theme still works without storage. */ }
  }, []);

  useEffect(() => {
    const syncTheme = (event: StorageEvent) => {
      if (event.storageArea !== null && event.storageArea !== localStorage) return;
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        setThemeState(event.newValue === 'dark' ? 'dark' : 'light');
      }
    };
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  return { theme, setTheme };
}
