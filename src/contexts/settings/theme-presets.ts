import type { CustomThemeConfig, Theme, ThemePresetId } from './types';

export interface ThemePreset {
    id: ThemePresetId;
    labelKey: string;
    fallbackLabel: string;
    defaultTheme: Theme;
    themes: Record<Theme, CustomThemeConfig>;
}

type ThemeTranslator = (key: string) => string;

function translateWithFallback(t: ThemeTranslator, key: string, fallback: string): string {
    const translated = t(key);
    return translated === key ? fallback : translated;
}

function createPresetColors(colors: NonNullable<CustomThemeConfig['colors']>): CustomThemeConfig {
    return { colors };
}

function createPresetConfig(config: CustomThemeConfig): CustomThemeConfig {
    return config;
}

function normalizeThemeConfig(config: CustomThemeConfig, options?: { includeBrand?: boolean }): string {
    const colors = config.colors
        ? Object.fromEntries(
            Object.entries(config.colors)
                .filter(([, value]) => Boolean(value))
                .sort(([left], [right]) => left.localeCompare(right))
        )
        : undefined;

    const background = config.background
        ? Object.fromEntries(
            Object.entries(config.background)
                .filter(([, value]) => value !== undefined)
                .sort(([left], [right]) => left.localeCompare(right))
        )
        : undefined;

    const brand = options?.includeBrand === false || !config.brand
        ? undefined
        : config.brand
        ? Object.fromEntries(
            Object.entries(config.brand)
                .filter(([, value]) => Boolean(value))
                .sort(([left], [right]) => left.localeCompare(right))
        )
        : undefined;

    return JSON.stringify({
        ...(colors ? { colors } : {}),
        ...(background ? { background } : {}),
        ...(brand ? { brand } : {}),
    });
}

export const THEME_PRESETS: ThemePreset[] = [
    {
        id: 'default',
        labelKey: 'settings.theme_preset_default',
        fallbackLabel: 'Default',
        defaultTheme: 'dark',
        themes: {
            light: createPresetColors({
                background: '#f4f4f5',
                card: '#ffffff',
                textMain: '#18181b',
                textSecondary: '#52525b',
                border: '#e4e4e7',
                error: '#dc2626',
            }),
            dark: createPresetColors({
                background: '#18181b',
                card: '#27272a',
                textMain: '#ffffff',
                textSecondary: '#d4d4d8',
                border: '#3f3f46',
                error: '#dc2626',
            }),
        }
    },
    {
        id: 'midnight',
        labelKey: 'settings.theme_preset_midnight',
        fallbackLabel: 'Midnight',
        defaultTheme: 'dark',
        themes: {
            light: createPresetConfig({
                colors: {
                    background: '#eef2ff',
                    card: '#e0e7ff',
                    textMain: '#111827',
                    textSecondary: '#4b5563',
                    border: '#c7d2fe',
                    error: '#dc2626',
                },
                brand: {
                    shellGlow: '#6366f1',
                    markFrame: '#eef2ff',
                    markBorder: '#c7d2fe',
                    mediaFrame: '#e0e7ff',
                    mediaBorder: '#c7d2fe',
                },
            }),
            dark: createPresetConfig({
                colors: {
                    background: '#09090b', // zinc-950
                    card: '#18181b', // zinc-900
                    textMain: '#fafafa', // zinc-50
                    textSecondary: '#a1a1aa', // zinc-400
                    border: '#27272a', // zinc-800
                    error: '#ef4444', // red-500
                },
                brand: {
                    shellGlow: '#6366f1',
                    markFrame: '#101325',
                    markBorder: '#312e81',
                    mediaFrame: '#14182d',
                    mediaBorder: '#4338ca',
                },
            }),
        }
    },
    {
        id: 'forest',
        labelKey: 'settings.theme_preset_forest',
        fallbackLabel: 'Forest',
        defaultTheme: 'dark',
        themes: {
            light: createPresetConfig({
                colors: {
                    background: '#ecfdf5', // emerald-50
                    card: '#d1fae5', // emerald-100
                    textMain: '#064e3b', // emerald-900
                    textSecondary: '#047857', // emerald-700
                    border: '#6ee7b7', // emerald-300
                    error: '#dc2626', // red-600
                },
                brand: {
                    shellGlow: '#059669',
                    markFrame: '#ecfdf5',
                    markBorder: '#6ee7b7',
                    mediaFrame: '#d1fae5',
                    mediaBorder: '#6ee7b7',
                },
            }),
            dark: createPresetConfig({
                colors: {
                    background: '#052e16', // emerald-950
                    card: '#064e3b', // emerald-900
                    textMain: '#ecfdf5', // emerald-50
                    textSecondary: '#6ee7b7', // emerald-300
                    border: '#065f46', // emerald-800
                    error: '#f87171', // red-400
                },
                brand: {
                    shellGlow: '#34d399',
                    markFrame: '#062a17',
                    markBorder: '#047857',
                    mediaFrame: '#07351d',
                    mediaBorder: '#059669',
                },
            }),
        }
    },
    {
        id: 'light-plus',
        labelKey: 'settings.theme_preset_light_plus',
        fallbackLabel: 'Light+',
        defaultTheme: 'light',
        themes: {
            light: createPresetConfig({
                colors: {
                    background: '#ffffff',
                    card: '#f4f4f5', // zinc-100
                    textMain: '#18181b', // zinc-900
                    textSecondary: '#52525b', // zinc-600
                    border: '#e4e4e7', // zinc-200
                    error: '#dc2626', // red-600
                },
                brand: {
                    shellGlow: '#94a3b8',
                    markFrame: '#ffffff',
                    markBorder: '#d4d4d8',
                    mediaFrame: '#f4f4f5',
                    mediaBorder: '#d4d4d8',
                },
            }),
            dark: createPresetConfig({
                colors: {
                    background: '#18181b',
                    card: '#27272a',
                    textMain: '#fafafa',
                    textSecondary: '#d4d4d8',
                    border: '#52525b',
                    error: '#f87171',
                },
                brand: {
                    shellGlow: '#a1a1aa',
                    markFrame: '#202024',
                    markBorder: '#52525b',
                    mediaFrame: '#1d1d20',
                    mediaBorder: '#52525b',
                },
            }),
        }
    },
    {
        id: 'navy',
        labelKey: 'settings.theme_preset_navy',
        fallbackLabel: 'Navy',
        defaultTheme: 'dark',
        themes: {
            light: createPresetConfig({
                colors: {
                    background: '#eff6ff', // blue-50
                    card: '#dbeafe', // blue-100
                    textMain: '#1e3a8a', // blue-900
                    textSecondary: '#1d4ed8', // blue-700
                    border: '#93c5fd', // blue-300
                    error: '#dc2626', // red-600
                },
                brand: {
                    shellGlow: '#3b82f6',
                    markFrame: '#eff6ff',
                    markBorder: '#93c5fd',
                    mediaFrame: '#dbeafe',
                    mediaBorder: '#93c5fd',
                },
            }),
            dark: createPresetConfig({
                colors: {
                    background: '#0f172a', // slate-900
                    card: '#1e293b', // slate-800
                    textMain: '#f8fafc', // slate-50
                    textSecondary: '#94a3b8', // slate-400
                    border: '#334155', // slate-700
                    error: '#ef4444', // red-500
                },
                brand: {
                    shellGlow: '#3b82f6',
                    markFrame: '#121c2f',
                    markBorder: '#334155',
                    mediaFrame: '#162033',
                    mediaBorder: '#3b82f6',
                },
            }),
        }
    }
];

export function getThemePreset(presetId: ThemePresetId | string | null | undefined) {
    if (!presetId) {
        return undefined;
    }

    return THEME_PRESETS.find((preset) => preset.id === presetId);
}

export function getThemePresetLabel(
    t: ThemeTranslator,
    presetOrId: ThemePreset | ThemePresetId | string | null | undefined,
) {
    const preset = typeof presetOrId === 'object' && presetOrId !== null && 'labelKey' in presetOrId
        ? presetOrId
        : getThemePreset(presetOrId);

    if (!preset) {
        return undefined;
    }

    return translateWithFallback(t, preset.labelKey, preset.fallbackLabel);
}

export function getThemePresetSummary(
    t: ThemeTranslator,
    presetOrId: ThemePreset | ThemePresetId | string | null | undefined,
    theme: Theme,
) {
    const presetLabel = getThemePresetLabel(t, presetOrId);
    if (!presetLabel) {
        return undefined;
    }

    const modeLabel = translateWithFallback(
        t,
        theme === 'light' ? 'settings.theme_light' : 'settings.theme_dark',
        theme === 'light' ? 'Light' : 'Dark',
    );

    return `${presetLabel} · ${modeLabel}`;
}

export function getThemePresetConfig(
    presetId: ThemePresetId | string | null | undefined,
    theme: Theme,
) {
    return getThemePreset(presetId)?.themes[theme];
}

export function inferThemePresetId(
    theme: Theme,
    config: CustomThemeConfig | null | undefined,
): ThemePresetId | null {
    if (!config?.colors || config.background) {
        return null;
    }

    const normalized = normalizeThemeConfig(config, { includeBrand: false });
    const inferredPreset = THEME_PRESETS.find(
        (preset) => preset.id !== 'default' && normalizeThemeConfig(preset.themes[theme], { includeBrand: false }) === normalized,
    );

    return inferredPreset?.id ?? null;
}
