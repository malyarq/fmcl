import { getAccentHexForColor } from './accent';
import { getThemePresetConfig } from './theme-presets';
import type { Theme, AccentColor, CustomThemeConfig, ThemePresetId } from './types';

type ThemeDocumentColors = {
  background: string;
  card: string;
  overlay: string;
  sidebar: string;
  textMain: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderActive: string;
  error: string;
};

const DEFAULT_THEME_DOCUMENT_COLORS: Record<Theme, ThemeDocumentColors> = {
  light: {
    background: '#f4f4f5',
    card: '#ffffff',
    overlay: '#ffffff',
    sidebar: '#ffffff',
    textMain: '#18181b',
    textSecondary: '#52525b',
    textMuted: '#71717a',
    border: '#e4e4e7',
    borderActive: '#a1a1aa',
    error: '#dc2626',
  },
  dark: {
    background: '#18181b',
    card: '#27272a',
    overlay: '#18181b',
    sidebar: '#27272a',
    textMain: '#ffffff',
    textSecondary: '#d4d4d8',
    textMuted: '#a1a1aa',
    border: '#3f3f46',
    borderActive: '#71717a',
    error: '#dc2626',
  },
};

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

function mergeThemeConfig(base?: CustomThemeConfig, override?: CustomThemeConfig): CustomThemeConfig {
  const colors = {
    ...base?.colors,
    ...override?.colors,
  };

  const backgroundVideo = {
    ...base?.background?.video,
    ...override?.background?.video,
  };

  const backgroundParticles = {
    ...base?.background?.particles,
    ...override?.background?.particles,
  };

  const background = {
    ...base?.background,
    ...override?.background,
    ...(Object.keys(backgroundVideo).length > 0 ? { video: backgroundVideo } : {}),
    ...(Object.keys(backgroundParticles).length > 0 ? { particles: backgroundParticles } : {}),
  };

  return {
    ...(Object.keys(colors).length > 0 ? { colors } : {}),
    ...(Object.keys(background).length > 0 ? { background } : {}),
  };
}

function buildThemeDocumentColors(theme: Theme, customTheme?: CustomThemeConfig): ThemeDocumentColors {
  const defaults = DEFAULT_THEME_DOCUMENT_COLORS[theme];
  const colors = customTheme?.colors;

  return {
    background: colors?.background ?? defaults.background,
    card: colors?.card ?? defaults.card,
    overlay: colors?.card ?? colors?.background ?? defaults.overlay,
    sidebar: colors?.card ?? defaults.sidebar,
    textMain: colors?.textMain ?? defaults.textMain,
    textSecondary: colors?.textSecondary ?? defaults.textSecondary,
    textMuted: colors?.textSecondary ?? defaults.textMuted,
    border: colors?.border ?? defaults.border,
    borderActive: colors?.border ?? defaults.borderActive,
    error: colors?.error ?? defaults.error,
  };
}

export function resolveThemeConfig(
  theme: Theme,
  themePresetId?: ThemePresetId | null,
  customTheme?: CustomThemeConfig,
) {
  const presetConfig = getThemePresetConfig(themePresetId, theme);
  return mergeThemeConfig(presetConfig, customTheme);
}

export function applyThemeToDocument(theme: Theme, accentColor: AccentColor, customTheme?: CustomThemeConfig) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);

  const root = document.documentElement;
  const accentHex = getAccentHexForColor(accentColor || 'emerald');
  const palette = buildThemeDocumentColors(theme, customTheme);

  root.style.setProperty('--bg-app', hexToRgb(palette.background));
  root.style.setProperty('--bg-card', hexToRgb(palette.card));
  root.style.setProperty('--bg-overlay', hexToRgb(palette.overlay));
  root.style.setProperty('--bg-sidebar', hexToRgb(palette.sidebar));
  root.style.setProperty('--text-main', hexToRgb(palette.textMain));
  root.style.setProperty('--text-secondary', hexToRgb(palette.textSecondary));
  root.style.setProperty('--text-muted', hexToRgb(palette.textMuted));
  root.style.setProperty('--border-default', hexToRgb(palette.border));
  root.style.setProperty('--border-active', hexToRgb(palette.borderActive));
  root.style.setProperty('--accent-main', hexToRgb(accentHex));
  root.style.setProperty('--accent-hover', hexToRgb(accentHex));
  root.style.setProperty('--accent-content', getAccentContent(theme));
  root.style.setProperty('--color-error', hexToRgb(palette.error));
}
