import { getAccentHexForColor } from './accent';
import type { Theme, AccentColor, CustomThemeConfig } from './types';

function hexToRgb(hex: string) {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

function getAccentContent(theme: Theme) {
  return theme === 'light' ? '24 24 27' : '255 255 255';
}

export function applyThemeToDocument(theme: Theme, accentColor: AccentColor, customTheme?: CustomThemeConfig) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);

  // Reset custom properties
  const root = document.documentElement;
  root.style.removeProperty('--bg-app');
  root.style.removeProperty('--bg-card');
  root.style.removeProperty('--bg-overlay');
  root.style.removeProperty('--bg-sidebar');
  root.style.removeProperty('--text-main');
  root.style.removeProperty('--text-secondary');
  root.style.removeProperty('--text-muted');
  root.style.removeProperty('--border-default');
  root.style.removeProperty('--border-active');
  root.style.removeProperty('--accent-main');
  root.style.removeProperty('--accent-hover');
  root.style.removeProperty('--accent-content');

  const accentHex = getAccentHexForColor(accentColor || 'emerald');
  root.style.setProperty('--accent-main', hexToRgb(accentHex));
  root.style.setProperty('--accent-hover', hexToRgb(accentHex));
  root.style.setProperty('--accent-content', getAccentContent(theme));

  // Apply custom colors if present
  if (customTheme?.colors) {
    if (customTheme.colors.background) root.style.setProperty('--bg-app', hexToRgb(customTheme.colors.background));
    if (customTheme.colors.card) {
      root.style.setProperty('--bg-card', hexToRgb(customTheme.colors.card));
      root.style.setProperty('--bg-sidebar', hexToRgb(customTheme.colors.card));
    }
    if (customTheme.colors.textMain) root.style.setProperty('--text-main', hexToRgb(customTheme.colors.textMain));
    if (customTheme.colors.textSecondary) root.style.setProperty('--text-secondary', hexToRgb(customTheme.colors.textSecondary));
    if (customTheme.colors.border) root.style.setProperty('--border-default', hexToRgb(customTheme.colors.border));
    if (customTheme.colors.error) root.style.setProperty('--color-error', hexToRgb(customTheme.colors.error));
  }
}
