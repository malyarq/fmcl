import { getAccentHexForColor, getAccentHoverHexForColor } from './accent';
import type { AccentColor, BrandThemeConfig, CustomThemeConfig, Theme } from './types';

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

type BrandDocumentTokens = Required<BrandThemeConfig>;

const DEFAULT_THEME_DOCUMENT_COLORS: Record<Theme, ThemeDocumentColors> = {
  light: {
    background: '#f4f4f5', card: '#ffffff', overlay: '#ffffff', sidebar: '#ffffff',
    textMain: '#18181b', textSecondary: '#52525b', textMuted: '#71717a',
    border: '#e4e4e7', borderActive: '#a1a1aa', error: '#dc2626',
  },
  dark: {
    background: '#18181b', card: '#27272a', overlay: '#18181b', sidebar: '#27272a',
    textMain: '#ffffff', textSecondary: '#d4d4d8', textMuted: '#a1a1aa',
    border: '#3f3f46', borderActive: '#71717a', error: '#dc2626',
  },
};

const DEFAULT_BRAND_DOCUMENT_TOKENS: Record<Theme, BrandDocumentTokens> = {
  light: {
    shellGlow: '#6b8b6f', markFrame: '#eef2e8', markBorder: '#cbd5c2', markGlow: '#314338',
    mediaFrame: '#edf1e8', mediaBorder: '#d2dad0',
    surfacePanelShadow: '0 24px 80px rgba(24, 31, 27, 0.16)',
    surfaceCardShadow: '0 14px 48px rgba(24, 31, 27, 0.12)',
    surfaceSoftShadow: '0 8px 24px rgba(24, 31, 27, 0.08)',
    wordmarkWeight: '460', wordmarkSpacing: '-0.035em',
  },
  dark: {
    shellGlow: '#7aa57d', markFrame: '#131916', markBorder: '#344138', markGlow: '#8eb795',
    mediaFrame: '#1a221c', mediaBorder: '#36433a',
    surfacePanelShadow: '0 24px 80px rgba(0, 0, 0, 0.26)',
    surfaceCardShadow: '0 14px 48px rgba(0, 0, 0, 0.22)',
    surfaceSoftShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
    wordmarkWeight: '460', wordmarkSpacing: '-0.035em',
  },
};

function hexToRgb(hex: string) {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  return `${parseInt(normalized.slice(1, 3), 16)} ${parseInt(normalized.slice(3, 5), 16)} ${parseInt(normalized.slice(5, 7), 16)}`;
}

function getRelativeLuminance(hex: string): number {
  const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
  const linear = [0, 2, 4].map((offset) => {
    const channel = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function getContrastRatio(first: string, second: string): number {
  const firstLuminance = getRelativeLuminance(first);
  const secondLuminance = getRelativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function getAccentContent(accentHex: string) {
  const zinc = '#18181b';
  const white = '#ffffff';
  return getContrastRatio(accentHex, zinc) >= getContrastRatio(accentHex, white)
    ? '24 24 27'
    : '255 255 255';
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

function buildBrandDocumentTokens(theme: Theme, customTheme?: CustomThemeConfig): BrandDocumentTokens {
  return { ...DEFAULT_BRAND_DOCUMENT_TOKENS[theme], ...customTheme?.brand };
}

export function applyThemeToDocument(theme: Theme, accentColor: AccentColor, customTheme?: CustomThemeConfig) {
  const root = document.documentElement;
  const accentHex = getAccentHexForColor(accentColor || 'emerald');
  const palette = buildThemeDocumentColors(theme, customTheme);
  const brandTokens = buildBrandDocumentTokens(theme, customTheme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('dark', theme === 'dark');

  const properties: Record<string, string> = {
    '--bg-app': hexToRgb(palette.background),
    '--bg-card': hexToRgb(palette.card),
    '--bg-overlay': hexToRgb(palette.overlay),
    '--bg-sidebar': hexToRgb(palette.sidebar),
    '--text-main': hexToRgb(palette.textMain),
    '--text-secondary': hexToRgb(palette.textSecondary),
    '--text-muted': hexToRgb(palette.textMuted),
    '--border-default': hexToRgb(palette.border),
    '--border-active': hexToRgb(palette.borderActive),
    '--accent-main': hexToRgb(accentHex),
    '--accent-hover': hexToRgb(getAccentHoverHexForColor(accentColor || 'emerald')),
    '--accent-content': getAccentContent(accentHex),
    '--color-error': hexToRgb(palette.error),
    '--brand-shell-glow': hexToRgb(brandTokens.shellGlow),
    '--brand-mark-frame': hexToRgb(brandTokens.markFrame),
    '--brand-mark-border': hexToRgb(brandTokens.markBorder),
    '--brand-mark-glow': hexToRgb(brandTokens.markGlow),
    '--brand-media-frame': hexToRgb(brandTokens.mediaFrame),
    '--brand-media-border': hexToRgb(brandTokens.mediaBorder),
    '--surface-shadow-panel': brandTokens.surfacePanelShadow,
    '--surface-shadow-card': brandTokens.surfaceCardShadow,
    '--surface-shadow-soft': brandTokens.surfaceSoftShadow,
    '--brand-wordmark-weight': brandTokens.wordmarkWeight,
    '--brand-wordmark-spacing': brandTokens.wordmarkSpacing,
  };

  Object.entries(properties).forEach(([property, value]) => root.style.setProperty(property, value));
}
