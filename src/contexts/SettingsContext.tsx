import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import type { AccentColor, AccentStyleType, AppearanceSettingsState, BrandThemeConfig, DownloadProvider, Language, Theme, UIMode, CustomThemeConfig, ThemePresetId } from './settings/types';
import {
    deserializeBoolean,
    deserializeInt,
    deserializeString,
    serializeBoolean,
        serializeInt,
        serializeString,
        useLocalStorageState,
} from './settings/persistence';
import { getThemePreset, getThemePresetAccent, inferThemePresetId } from './settings/theme-presets';
import type { ThemeRuntimeState } from './settings/theme';
import { applyThemeToDocument, extractThemeOverrides, pruneThemeConfig, resolveAccentColor, resolveThemeConfig, resolveThemeRuntimeState } from './settings/theme';
import { createTranslator, getLocaleForLanguage } from './settings/i18n';
import { getAccentClassForColor, getAccentHexForColor, getAccentStylesForColor, getPresetAccentSafelistClassName } from './settings/accent';
import { formatDateForLocale, formatNumberForLocale } from '../utils/format';
import { windowControlsIPC } from '../services/ipc/windowControlsIPC';

interface SettingsState {
    minecraftPath: string;
    setMinecraftPath: (val: string) => void;
    hideLauncher: boolean;
    setHideLauncher: (val: boolean) => void;
    accentColor: AccentColor;
    setAccentColor: (val: AccentColor) => void;
    showConsole: boolean;
    setShowConsole: (val: boolean) => void;
    language: Language;
    setLanguage: (val: Language) => void;
    theme: Theme;
    setTheme: (val: Theme) => void;
    themePresetId: ThemePresetId | null;
    applyThemePreset: (presetId: ThemePresetId) => void;
    clearThemePreset: () => void;
    applyAppearanceState: (val: AppearanceSettingsState) => void;
    downloadProvider: DownloadProvider;
    setDownloadProvider: (val: DownloadProvider) => void;
    autoDownloadThreads: boolean;
    setAutoDownloadThreads: (val: boolean) => void;
    downloadThreads: number;
    setDownloadThreads: (val: number) => void;
    maxSockets: number;
    setMaxSockets: (val: number) => void;
    // Global UI mode – controls Classic vs Modpacks layout.
    uiMode: UIMode;
    setUIMode: (val: UIMode) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    locale: string;
    formatDate: (timestamp: number | undefined, unknownText?: string, options?: Intl.DateTimeFormatOptions) => string;
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
    getAccentStyles: (type: AccentStyleType) => { className?: string; style?: React.CSSProperties };
    getAccentClass: (tailwindClasses: string) => string;
    getAccentHex: () => string;
    customTheme: CustomThemeConfig;
    activeThemeConfig: CustomThemeConfig;
    themeRuntimeState: ThemeRuntimeState;
    brandTheme: BrandThemeConfig;
    setCustomTheme: (val: CustomThemeConfig) => void;
    uiScale: number;
    setUiScale: (val: number) => void;
    disableAnimations: boolean;
    setDisableAnimations: (val: boolean) => void;
    sidebarPosition: 'left' | 'right';
    setSidebarPosition: (val: 'left' | 'right') => void;
    compactMode: boolean;
    setCompactMode: (val: boolean) => void;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

const DEFAULT_APPEARANCE_STATE: AppearanceSettingsState = {
    accentColor: 'emerald',
    accentColorSource: 'preset',
    customTheme: {},
    theme: 'dark',
    themePresetId: null,
};

function parseStoredTheme(raw: string | null): Theme {
    return raw === 'light' ? 'light' : 'dark';
}

function parseStoredThemePresetId(raw: string | null): ThemePresetId | null {
    if (!raw) {
        return null;
    }

    return getThemePreset(raw)?.id ?? null;
}

function parseStoredAccentColor(raw: string | null): AccentColor {
    return raw || DEFAULT_APPEARANCE_STATE.accentColor;
}

function parseStoredCustomTheme(raw: string | null): CustomThemeConfig {
    if (!raw) {
        return {};
    }

    try {
        return pruneThemeConfig(JSON.parse(raw) as CustomThemeConfig);
    } catch {
        return {};
    }
}

function normalizeAppearanceState(state: AppearanceSettingsState): AppearanceSettingsState {
    const normalizedTheme = state.theme === 'light' ? 'light' : 'dark';
    const normalizedPresetId = state.themePresetId ? parseStoredThemePresetId(state.themePresetId) : null;
    const normalizedAccentSource = state.accentColorSource === 'user'
        ? 'user'
        : state.accentColorSource === 'preset'
            ? 'preset'
            : normalizedPresetId
                ? state.accentColor === (getThemePresetAccent(normalizedPresetId, normalizedTheme) ?? DEFAULT_APPEARANCE_STATE.accentColor)
                    ? 'preset'
                    : 'user'
                : state.accentColor === DEFAULT_APPEARANCE_STATE.accentColor
                    ? 'preset'
                    : 'user';
    const normalizedAccentColor = resolveAccentColor(
        normalizedTheme,
        normalizedPresetId,
        parseStoredAccentColor(state.accentColor),
        normalizedAccentSource,
    );
    const sanitizedCustomTheme = normalizedPresetId
        ? extractThemeOverrides(normalizedTheme, normalizedPresetId, state.customTheme)
        : pruneThemeConfig(state.customTheme);

    return {
        accentColor: normalizedAccentColor,
        accentColorSource: normalizedAccentSource,
        customTheme: sanitizedCustomTheme,
        theme: normalizedTheme,
        themePresetId: normalizedPresetId,
    };
}

function deserializeAppearanceState(raw: string | null): AppearanceSettingsState {
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<AppearanceSettingsState>;
            return normalizeAppearanceState({
                accentColor: parseStoredAccentColor(typeof parsed.accentColor === 'string' ? parsed.accentColor : null),
                accentColorSource: parsed.accentColorSource === 'user'
                    ? 'user'
                    : parsed.accentColorSource === 'preset'
                        ? 'preset'
                        : undefined,
                customTheme: pruneThemeConfig(parsed.customTheme),
                theme: parsed.theme === 'light' ? 'light' : 'dark',
                themePresetId: typeof parsed.themePresetId === 'string' ? parsed.themePresetId : null,
            });
        } catch {
            // Fall through to legacy key migration.
        }
    }

    const legacyTheme = parseStoredTheme(localStorage.getItem('settings_theme'));
    const legacyAccentColor = parseStoredAccentColor(localStorage.getItem('settings_accentColor'));
    const explicitPresetId = parseStoredThemePresetId(localStorage.getItem('settings_themePresetId'));
    const legacyCustomTheme = parseStoredCustomTheme(localStorage.getItem('settings_customTheme'));
    const inferredPresetId = explicitPresetId ?? inferThemePresetId(legacyTheme, legacyCustomTheme);

    return normalizeAppearanceState({
        accentColor: legacyAccentColor,
        customTheme: explicitPresetId ? extractThemeOverrides(legacyTheme, explicitPresetId, legacyCustomTheme) : legacyCustomTheme,
        theme: legacyTheme,
        themePresetId: inferredPresetId,
    });
}

function serializeAppearanceState(state: AppearanceSettingsState) {
    return JSON.stringify(normalizeAppearanceState(state));
}

// Centralized UI settings with localStorage persistence.
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [minecraftPath, setMinecraftPath] = useLocalStorageState('settings_minecraftPath', deserializeString(''), serializeString);
    const [hideLauncher, setHideLauncher] = useLocalStorageState('settings_hideLauncher', deserializeBoolean(true), serializeBoolean);
    // Console visibility is session state. Persisting it used to reopen the
    // debug window in front of the launcher after every application restart.
    const [showConsole, setShowConsole] = useLocalStorageState('settings_showConsole', () => false, serializeBoolean);
    const [language, setLanguage] = useLocalStorageState<Language>('settings_language', (raw) => (raw === 'ru' ? 'ru' : 'en'), serializeString);
    const [appearanceState, setAppearanceStateRaw] = useLocalStorageState<AppearanceSettingsState>(
        'settings_appearanceState',
        deserializeAppearanceState,
        serializeAppearanceState,
    );
    const [legacyDownloadProvider, setDownloadProvider] = useLocalStorageState<DownloadProvider>(
        'settings_downloadProvider',
        (raw) => (raw === 'mojang' || raw === 'bmcl' ? raw : 'auto'),
        serializeString
    );
    const [autoDownloadThreads, setAutoDownloadThreads] = useLocalStorageState('settings_autoDownloadThreads', deserializeBoolean(true), serializeBoolean);
    const [downloadThreads, setDownloadThreads] = useLocalStorageState('settings_downloadThreads', deserializeInt(8), serializeInt);
    const [maxSockets, setMaxSockets] = useLocalStorageState('settings_maxSockets', deserializeInt(64), serializeInt);
    const downloadProvider: DownloadProvider = 'auto';

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const { accentColor, accentColorSource, customTheme, theme, themePresetId } = appearanceState;
    const applyAppearanceState = useCallback((nextState: AppearanceSettingsState) => {
        setAppearanceStateRaw(normalizeAppearanceState(nextState));
    }, [setAppearanceStateRaw]);
    const setAccentColor = useCallback((val: AccentColor) => {
        applyAppearanceState({
            ...appearanceState,
            accentColor: val,
            accentColorSource: 'user',
        });
    }, [appearanceState, applyAppearanceState]);
    const setTheme = useCallback((val: Theme) => {
        applyAppearanceState({
            ...appearanceState,
            theme: val,
        });
    }, [appearanceState, applyAppearanceState]);
    const clearThemePreset = useCallback(() => {
        applyAppearanceState({
            ...appearanceState,
            themePresetId: null,
            accentColorSource: appearanceState.accentColorSource === 'preset' ? 'preset' : 'user',
        });
    }, [appearanceState, applyAppearanceState]);
    const setCustomTheme = useCallback((val: CustomThemeConfig) => {
        applyAppearanceState({
            ...appearanceState,
            customTheme: themePresetId ? extractThemeOverrides(theme, themePresetId, val) : pruneThemeConfig(val),
        });
    }, [appearanceState, applyAppearanceState, theme, themePresetId]);
    const applyThemePreset = useCallback((presetId: ThemePresetId) => {
        const preset = getThemePreset(presetId);
        if (!preset) {
            return;
        }

        const nextTheme = appearanceState.themePresetId ? appearanceState.theme : preset.defaultTheme;

        applyAppearanceState({
            ...appearanceState,
            customTheme: {},
            theme: nextTheme,
            themePresetId: preset.id,
            accentColorSource: accentColorSource === 'user' ? 'user' : 'preset',
        });
    }, [accentColorSource, appearanceState, applyAppearanceState]);
    const activeThemeConfig = useMemo(
        () => resolveThemeConfig(theme, themePresetId, customTheme),
        [customTheme, theme, themePresetId],
    );
    const themeRuntimeState = useMemo(
        () => resolveThemeRuntimeState(theme, themePresetId, customTheme, accentColor, accentColorSource),
        [accentColor, accentColorSource, customTheme, theme, themePresetId],
    );
    const brandTheme = activeThemeConfig.brand ?? {};

    const [uiScale, setUiScale] = useLocalStorageState('settings_uiScale', deserializeInt(100), serializeInt);
    const [disableAnimations, setDisableAnimations] = useLocalStorageState('settings_disableAnimations', deserializeBoolean(false), serializeBoolean);
    const [sidebarPosition, setSidebarPosition] = useLocalStorageState<'left' | 'right'>('settings_sidebarPosition', (raw) => (raw === 'right' ? 'right' : 'left'), serializeString);
    const [compactMode, setCompactMode] = useLocalStorageState('settings_compactMode', deserializeBoolean(false), serializeBoolean);

    // UI mode: simple play vs modpacks, persisted across sessions.
    const [uiMode, setUIMode] = useLocalStorageState<UIMode>(
        'settings_uiMode',
        (raw) => (raw === 'modpacks' ? 'modpacks' : 'simple'),
        serializeString,
    );

    useEffect(() => {
        applyThemeToDocument(theme, accentColor, activeThemeConfig);
    }, [theme, accentColor, activeThemeConfig]);

    useEffect(() => {
        localStorage.setItem('settings_theme', theme);
        localStorage.setItem('settings_accentColor', accentColor);
        localStorage.setItem('settings_customTheme', JSON.stringify(customTheme));

        if (themePresetId) {
            localStorage.setItem('settings_themePresetId', themePresetId);
        } else {
            localStorage.removeItem('settings_themePresetId');
        }
    }, [accentColor, customTheme, theme, themePresetId]);

    useEffect(() => {
        if (legacyDownloadProvider !== 'auto') {
            setDownloadProvider('auto');
        }
    }, [legacyDownloadProvider, setDownloadProvider]);

    useEffect(() => {
        document.documentElement.style.fontSize = `${uiScale}%`;
    }, [uiScale]);

    useEffect(() => {
        if (disableAnimations) {
            document.body.classList.add('disable-animations');
        } else {
            document.body.classList.remove('disable-animations');
        }
    }, [disableAnimations]);

    useEffect(() => {
        if (compactMode) {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }
    }, [compactMode]);

    const t = useMemo(() => createTranslator(language), [language]);
    const locale = useMemo(() => getLocaleForLanguage(language), [language]);
    const formatDate = useCallback(
        (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
            formatDateForLocale(timestamp, locale, unknownText, options),
        [locale],
    );
    const formatNumber = useCallback(
        (value: number, options?: Intl.NumberFormatOptions) => formatNumberForLocale(value, locale, options),
        [locale],
    );

    const getAccentHex = useCallback(() => getAccentHexForColor(accentColor), [accentColor]);
    const getAccentStyles = useCallback(
        (type: AccentStyleType) => getAccentStylesForColor(accentColor, type, theme),
        [accentColor, theme]
    );
    const getAccentClass = useCallback((tailwindClasses: string) => getAccentClassForColor(accentColor, tailwindClasses), [accentColor]);

    const setShowConsoleProxy = useCallback((val: boolean) => {
        setShowConsole(val);
    }, [setShowConsole]);

    // The console has its own renderer and SettingsProvider. It must not close
    // itself while booting or mirror the main window's console toggle.
    useEffect(() => {
        if (window.location.hash === '#console') return;
        if (showConsole) windowControlsIPC.openConsole();
        else windowControlsIPC.closeConsole();
    }, [showConsole]);

    return (
        <SettingsContext.Provider value={{
            minecraftPath, setMinecraftPath,
            hideLauncher, setHideLauncher,
            accentColor, setAccentColor,
            showConsole, setShowConsole: setShowConsoleProxy,
            language, setLanguage,
            theme, setTheme,
            themePresetId,
            applyThemePreset,
            clearThemePreset,
            applyAppearanceState,
            downloadProvider, setDownloadProvider,
            autoDownloadThreads, setAutoDownloadThreads,
            downloadThreads, setDownloadThreads,
            maxSockets, setMaxSockets,
            uiMode, setUIMode,
            t,
            locale,
            formatDate,
            formatNumber,
            getAccentStyles,
            getAccentClass,
            getAccentHex,
            customTheme,
            activeThemeConfig,
            themeRuntimeState,
            brandTheme,
            setCustomTheme,
            uiScale, setUiScale,
            disableAnimations, setDisableAnimations,
            sidebarPosition, setSidebarPosition,
            compactMode, setCompactMode
        }}>
            {children}
            {/* Hidden div to prevent Tailwind from purging preset color classes */}
            <div className={`hidden ${getPresetAccentSafelistClassName()}`} />
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};

// Convenience hook for working with the global UI mode.
// eslint-disable-next-line react-refresh/only-export-components
export const useUIMode = () => {
    const { uiMode, setUIMode } = useSettings();
    return {
        uiMode,
        setMode: setUIMode,
    };
};
