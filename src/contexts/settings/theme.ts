import type { Theme } from './types';

export function applyThemeToDocument(theme: Theme) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
}

