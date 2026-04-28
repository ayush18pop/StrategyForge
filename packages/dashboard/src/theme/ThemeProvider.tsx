import { useCallback, useEffect, useState } from 'react';
import type { ThemeContextValue } from './useTheme';
import { ThemeContext } from './theme-context';

type ThemeMode = ThemeContextValue['mode'];
type ResolvedTheme = ThemeContextValue['resolved'];

const STORAGE_KEY = 'sf-theme';

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'auto' ? getSystemTheme() : mode;
}

function applyTheme(resolved: ResolvedTheme): void {
  const html = document.documentElement;
  html.classList.add('theme-transitioning');
  html.dataset.theme = resolved;
  setTimeout(() => html.classList.remove('theme-transitioning'), 250);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'auto') return stored;
    return 'dark';
  });

  const resolved = resolveTheme(mode);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // Sync with system preference when mode === 'auto'
  useEffect(() => {
    if (mode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
