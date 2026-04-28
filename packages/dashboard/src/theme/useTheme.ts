import { useContext } from 'react';
import { ThemeContext } from './theme-context';

export interface ThemeContextValue {
  mode: 'dark' | 'light' | 'auto';
  resolved: 'dark' | 'light';
  setMode: (mode: 'dark' | 'light' | 'auto') => void;
  toggle: () => void;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
