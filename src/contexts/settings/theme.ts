import { DEFAULT_ACCENT_COLOR, getAccentHexForColor, getAccentHoverHexForColor } from './accent';
import { getThemePreset, getThemePresetAccent, getThemePresetConfig } from './theme-presets';
import type { AccentColor, BrandThemeConfig, CustomThemeConfig, Theme, ThemePresetId } from './types';

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

export type ThemeCustomizationScope = 'accent' | 'colors' | 'background' | 'brand';

export interface ThemeRuntimeState {
  activePresetId: ThemePresetId | null;
  customizationScopes: ThemeCustomizationScope[];
  hasCustomizations: boolean;
  matchesPresetDefaultMode: boolean;
}

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

const DEFAULT_BRAND_DOCUMENT_TOKENS: Record<Theme, BrandDocumentTokens> = {
  light: {
    shellGlow: '#6b8b6f',
    markFrame: '#eef2e8',
    markBorder: '#cbd5c2',
    markGlow: '#314338',
    mediaFrame: '#edf1e8',
    mediaBorder: '#d2dad0',
    surfacePanelShadow: '0 24px 80px rgba(24, 31, 27, 0.16)',
    surfaceCardShadow: '0 14px 48px rgba(24, 31, 27, 0.12)',
    surfaceSoftShadow: '0 8px 24px rgba(24, 31, 27, 0.08)',
    wordmarkWeight: '820',
    wordmarkSpacing: '0.08em',
  },
  dark: {
    shellGlow: '#7aa57d',
    markFrame: '#131916',
    markBorder: '#344138',
    markGlow: '#8eb795',
    mediaFrame: '#1a221c',
    mediaBorder: '#36433a',
    surfacePanelShadow: '0 24px 80px rgba(0, 0, 0, 0.26)',
    surfaceCardShadow: '0 14px 48px rgba(0, 0, 0, 0.22)',
    surfaceSoftShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
    wordmarkWeight: '820',
    wordmarkSpacing: '0.08em',
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pruneThemeValue(value: unknown): unknown {
  if (!isRecord(value)) {
    return value === undefined || value === null || value === '' ? undefined : value;
  }

  const nextEntries = Object.entries(value).reduce<Record<string, unknown>>((acc, [key, entry]) => {
    const pruned = pruneThemeValue(entry);
    if (pruned !== undefined) {
      acc[key] = pruned;
    }
    return acc;
  }, {});

  return Object.keys(nextEntries).length > 0 ? nextEntries : undefined;
}

function diffThemeValue(base: unknown, next: unknown): unknown {
  if (!isRecord(next)) {
    if (next === undefined || next === null || next === '') {
      return undefined;
    }

    return base === next ? undefined : next;
  }

  const baseRecord = isRecord(base) ? base : undefined;
  const diffEntries = Object.entries(next).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const diff = diffThemeValue(baseRecord?.[key], value);
    if (diff !== undefined) {
      acc[key] = diff;
    }
    return acc;
  }, {});

  return Object.keys(diffEntries).length > 0 ? diffEntries : undefined;
}

function mergeThemeConfig(base?: CustomThemeConfig, override?: CustomThemeConfig): CustomThemeConfig {
  const colors = {
    ...base?.colors,
    ...override?.colors,
  };
  const brand = {
    ...base?.brand,
    ...override?.brand,
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
    ...(Object.keys(brand).length > 0 ? { brand } : {}),
  };
}

export function pruneThemeConfig(config: CustomThemeConfig | null | undefined): CustomThemeConfig {
  const pruned = pruneThemeValue(config) as CustomThemeConfig | undefined;
  return pruned ?? {};
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
  return {
    ...DEFAULT_BRAND_DOCUMENT_TOKENS[theme],
    ...customTheme?.brand,
  };
}

export function resolveThemeConfig(
  theme: Theme,
  themePresetId?: ThemePresetId | null,
  customTheme?: CustomThemeConfig,
) {
  const presetConfig = getThemePresetConfig(themePresetId, theme);
  return pruneThemeConfig(mergeThemeConfig(presetConfig, customTheme));
}

export function extractThemeOverrides(
  theme: Theme,
  themePresetId: ThemePresetId | null | undefined,
  config: CustomThemeConfig | null | undefined,
) {
  const prunedConfig = pruneThemeConfig(config);
  const presetConfig = getThemePresetConfig(themePresetId, theme);

  if (!presetConfig) {
    return prunedConfig;
  }

  const diff = diffThemeValue(pruneThemeConfig(presetConfig), prunedConfig) as CustomThemeConfig | undefined;
  return diff ?? {};
}

export function getThemeCustomizationScopes(
  config: CustomThemeConfig | null | undefined,
): ThemeCustomizationScope[] {
  const prunedConfig = pruneThemeConfig(config);

  return (['colors', 'background', 'brand'] as const).filter((scope) => {
    const entry = prunedConfig[scope];
    return isRecord(entry) && Object.keys(entry).length > 0;
  });
}

export function resolveAccentColor(
  theme: Theme,
  themePresetId: ThemePresetId | null | undefined,
  accentColor: AccentColor,
  accentColorSource: 'preset' | 'user' = 'preset',
) {
  if (accentColorSource === 'user') {
    return accentColor || DEFAULT_ACCENT_COLOR;
  }

  return getThemePresetAccent(themePresetId, theme) ?? DEFAULT_ACCENT_COLOR;
}

export function resolveThemeRuntimeState(
  theme: Theme,
  themePresetId: ThemePresetId | null | undefined,
  customTheme: CustomThemeConfig | null | undefined,
  accentColor: AccentColor,
  accentColorSource: 'preset' | 'user' = 'preset',
): ThemeRuntimeState {
  const preset = getThemePreset(themePresetId);
  const customizationScopes = getThemeCustomizationScopes(customTheme);
  const accentDefault = preset ? getThemePresetAccent(preset.id, theme) : DEFAULT_ACCENT_COLOR;
  const hasAccentCustomization = accentColorSource === 'user'
    && accentColor !== accentDefault;
  const scopes: ThemeCustomizationScope[] = hasAccentCustomization
    ? ['accent', ...customizationScopes]
    : customizationScopes;

  return {
    activePresetId: preset?.id ?? null,
    customizationScopes: scopes,
    hasCustomizations: scopes.length > 0,
    matchesPresetDefaultMode: preset ? preset.defaultTheme === theme : false,
  };
}

export function applyThemeToDocument(theme: Theme, accentColor: AccentColor, customTheme?: CustomThemeConfig) {
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);

  const root = document.documentElement;
  const accentHex = getAccentHexForColor(accentColor || 'emerald');
  const accentHoverHex = getAccentHoverHexForColor(accentColor || 'emerald');
  const palette = buildThemeDocumentColors(theme, customTheme);
  const brandTokens = buildBrandDocumentTokens(theme, customTheme);

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
  root.style.setProperty('--accent-hover', hexToRgb(accentHoverHex));
  root.style.setProperty('--accent-content', getAccentContent(theme));
  root.style.setProperty('--color-error', hexToRgb(palette.error));
  root.style.setProperty('--brand-shell-glow', hexToRgb(brandTokens.shellGlow));
  root.style.setProperty('--brand-mark-frame', hexToRgb(brandTokens.markFrame));
  root.style.setProperty('--brand-mark-border', hexToRgb(brandTokens.markBorder));
  root.style.setProperty('--brand-mark-glow', hexToRgb(brandTokens.markGlow));
  root.style.setProperty('--brand-media-frame', hexToRgb(brandTokens.mediaFrame));
  root.style.setProperty('--brand-media-border', hexToRgb(brandTokens.mediaBorder));
  root.style.setProperty('--surface-shadow-panel', brandTokens.surfacePanelShadow);
  root.style.setProperty('--surface-shadow-card', brandTokens.surfaceCardShadow);
  root.style.setProperty('--surface-shadow-soft', brandTokens.surfaceSoftShadow);
  root.style.setProperty('--brand-wordmark-weight', brandTokens.wordmarkWeight);
  root.style.setProperty('--brand-wordmark-spacing', brandTokens.wordmarkSpacing);
}
