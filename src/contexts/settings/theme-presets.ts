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

function normalizeThemeConfig(config: CustomThemeConfig): string {
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

    return JSON.stringify({
        ...(colors ? { colors } : {}),
        ...(background ? { background } : {}),
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
            light: createPresetColors({
                background: '#eef2ff',
                card: '#e0e7ff',
                textMain: '#111827',
                textSecondary: '#4b5563',
                border: '#c7d2fe',
                error: '#dc2626',
            }),
            dark: createPresetColors({
                background: '#09090b', // zinc-950
                card: '#18181b', // zinc-900
                textMain: '#fafafa', // zinc-50
                textSecondary: '#a1a1aa', // zinc-400
                border: '#27272a', // zinc-800
                error: '#ef4444', // red-500
            }),
        }
    },
    {
        id: 'forest',
        labelKey: 'settings.theme_preset_forest',
        fallbackLabel: 'Forest',
        defaultTheme: 'dark',
        themes: {
            light: createPresetColors({
                background: '#ecfdf5', // emerald-50
                card: '#d1fae5', // emerald-100
                textMain: '#064e3b', // emerald-900
                textSecondary: '#047857', // emerald-700
                border: '#6ee7b7', // emerald-300
                error: '#dc2626', // red-600
            }),
            dark: createPresetColors({
                background: '#052e16', // emerald-950
                card: '#064e3b', // emerald-900
                textMain: '#ecfdf5', // emerald-50
                textSecondary: '#6ee7b7', // emerald-300
                border: '#065f46', // emerald-800
                error: '#f87171', // red-400
            }),
        }
    },
    {
        id: 'light-plus',
        labelKey: 'settings.theme_preset_light_plus',
        fallbackLabel: 'Light+',
        defaultTheme: 'light',
        themes: {
            light: createPresetColors({
                background: '#ffffff',
                card: '#f4f4f5', // zinc-100
                textMain: '#18181b', // zinc-900
                textSecondary: '#52525b', // zinc-600
                border: '#e4e4e7', // zinc-200
                error: '#dc2626', // red-600
            }),
            dark: createPresetColors({
                background: '#18181b',
                card: '#27272a',
                textMain: '#fafafa',
                textSecondary: '#d4d4d8',
                border: '#52525b',
                error: '#f87171',
            }),
        }
    },
    {
        id: 'navy',
        labelKey: 'settings.theme_preset_navy',
        fallbackLabel: 'Navy',
        defaultTheme: 'dark',
        themes: {
            light: createPresetColors({
                background: '#eff6ff', // blue-50
                card: '#dbeafe', // blue-100
                textMain: '#1e3a8a', // blue-900
                textSecondary: '#1d4ed8', // blue-700
                border: '#93c5fd', // blue-300
                error: '#dc2626', // red-600
            }),
            dark: createPresetColors({
                background: '#0f172a', // slate-900
                card: '#1e293b', // slate-800
                textMain: '#f8fafc', // slate-50
                textSecondary: '#94a3b8', // slate-400
                border: '#334155', // slate-700
                error: '#ef4444', // red-500
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

    const normalized = normalizeThemeConfig(config);
    const inferredPreset = THEME_PRESETS.find(
        (preset) => preset.id !== 'default' && normalizeThemeConfig(preset.themes[theme]) === normalized,
    );

    return inferredPreset?.id ?? null;
}
