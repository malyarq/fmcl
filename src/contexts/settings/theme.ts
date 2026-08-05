import { DEFAULT_ACCENT_COLOR } from './accent';
import { getThemePreset, getThemePresetAccent, getThemePresetConfig } from './theme-presets';
import type { AccentColor, CustomThemeConfig, Theme, ThemePresetId } from './types';

export { applyThemeToDocument } from './theme-document';

export type ThemeCustomizationScope = 'accent' | 'colors' | 'background' | 'brand';

export interface ThemeRuntimeState {
  activePresetId: ThemePresetId | null;
  customizationScopes: ThemeCustomizationScope[];
  hasCustomizations: boolean;
  matchesPresetDefaultMode: boolean;
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
    if (pruned !== undefined) acc[key] = pruned;
    return acc;
  }, {});
  return Object.keys(nextEntries).length > 0 ? nextEntries : undefined;
}

function diffThemeValue(base: unknown, next: unknown): unknown {
  if (!isRecord(next)) {
    if (next === undefined || next === null || next === '') return undefined;
    return base === next ? undefined : next;
  }

  const baseRecord = isRecord(base) ? base : undefined;
  const diffEntries = Object.entries(next).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const diff = diffThemeValue(baseRecord?.[key], value);
    if (diff !== undefined) acc[key] = diff;
    return acc;
  }, {});
  return Object.keys(diffEntries).length > 0 ? diffEntries : undefined;
}

function mergeThemeConfig(base?: CustomThemeConfig, override?: CustomThemeConfig): CustomThemeConfig {
  const colors = { ...base?.colors, ...override?.colors };
  const brand = { ...base?.brand, ...override?.brand };
  const backgroundVideo = { ...base?.background?.video, ...override?.background?.video };
  const backgroundParticles = { ...base?.background?.particles, ...override?.background?.particles };
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

export function resolveThemeConfig(
  theme: Theme,
  themePresetId?: ThemePresetId | null,
  customTheme?: CustomThemeConfig,
) {
  return pruneThemeConfig(mergeThemeConfig(getThemePresetConfig(themePresetId, theme), customTheme));
}

export function extractThemeOverrides(
  theme: Theme,
  themePresetId: ThemePresetId | null | undefined,
  config: CustomThemeConfig | null | undefined,
) {
  const prunedConfig = pruneThemeConfig(config);
  const presetConfig = getThemePresetConfig(themePresetId, theme);
  if (!presetConfig) return prunedConfig;
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
  if (accentColorSource === 'user') return accentColor || DEFAULT_ACCENT_COLOR;
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
  const hasAccentCustomization = accentColorSource === 'user' && accentColor !== accentDefault;
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
