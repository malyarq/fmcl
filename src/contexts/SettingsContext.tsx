import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import type { AccentColor, AccentStyleType, DownloadProvider, Language, Theme, UIMode, CustomThemeConfig, ThemePresetId } from './settings/types';
import {
    deserializeBoolean,
    deserializeInt,
    deserializeString,
    serializeBoolean,
        serializeInt,
        serializeString,
        useLocalStorageState,
} from './settings/persistence';
import { getThemePreset, inferThemePresetId } from './settings/theme-presets';
import { applyThemeToDocument, resolveThemeConfig } from './settings/theme';
import { createTranslator } from './settings/i18n';
import { getAccentClassForColor, getAccentHexForColor, getAccentStylesForColor, getPresetAccentSafelistClassName } from './settings/accent';

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
    getAccentStyles: (type: AccentStyleType) => { className?: string; style?: React.CSSProperties };
    getAccentClass: (tailwindClasses: string) => string;
    getAccentHex: () => string;
    customTheme: CustomThemeConfig;
    activeThemeConfig: CustomThemeConfig;
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

// Centralized UI settings with localStorage persistence.
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [minecraftPath, setMinecraftPath] = useLocalStorageState('settings_minecraftPath', deserializeString(''), serializeString);
    const [hideLauncher, setHideLauncher] = useLocalStorageState('settings_hideLauncher', deserializeBoolean(true), serializeBoolean);
    const [accentColor, setAccentColor] = useLocalStorageState<AccentColor>('settings_accentColor', deserializeString('emerald'), serializeString);
    const [showConsole, setShowConsole] = useLocalStorageState('settings_showConsole', deserializeBoolean(false), serializeBoolean);
    const [language, setLanguage] = useLocalStorageState<Language>('settings_language', (raw) => (raw === 'ru' ? 'ru' : 'en'), serializeString);
    const [theme, setTheme] = useLocalStorageState<Theme>('settings_theme', (raw) => (raw === 'light' ? 'light' : 'dark'), serializeString);
    const [themePresetId, setThemePresetIdState] = useLocalStorageState<ThemePresetId | null>(
        'settings_themePresetId',
        (raw) => {
            if (!raw) {
                return null;
            }

            return getThemePreset(raw)?.id ?? null;
        },
        (val) => val ?? '',
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
    // Custom theme configuration
    const [customTheme, setCustomThemeState] = useLocalStorageState<CustomThemeConfig>(
        'settings_customTheme',
        (raw) => {
            if (!raw) return {};
            try {
                return JSON.parse(raw);
            } catch {
                return {};
            }
        },
        (val) => JSON.stringify(val)
    );
    const clearThemePreset = useCallback(() => {
        setThemePresetIdState(null);
    }, [setThemePresetIdState]);
    const setCustomTheme = useCallback((val: CustomThemeConfig) => {
        clearThemePreset();
        setCustomThemeState(val);
    }, [clearThemePreset, setCustomThemeState]);
    const applyThemePreset = useCallback((presetId: ThemePresetId) => {
        const preset = getThemePreset(presetId);
        if (!preset) {
            return;
        }

        setThemePresetIdState(preset.id);
        setTheme(preset.defaultTheme);
        setCustomThemeState({});
    }, [setCustomThemeState, setTheme, setThemePresetIdState]);
    const activeThemeConfig = useMemo(
        () => resolveThemeConfig(theme, themePresetId, customTheme),
        [customTheme, theme, themePresetId],
    );

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
        const persistedThemePresetId = localStorage.getItem('settings_themePresetId');
        if (persistedThemePresetId !== null || themePresetId !== null) {
            return;
        }

        const inferredPresetId = inferThemePresetId(theme, customTheme);
        if (!inferredPresetId) {
            return;
        }

        setThemePresetIdState(inferredPresetId);
        setCustomThemeState({});
    }, [customTheme, theme, themePresetId, setCustomThemeState, setThemePresetIdState]);

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

    const getAccentHex = useCallback(() => getAccentHexForColor(accentColor), [accentColor]);
    const getAccentStyles = useCallback(
        (type: AccentStyleType) => getAccentStylesForColor(accentColor, type, theme),
        [accentColor, theme]
    );
    const getAccentClass = useCallback((tailwindClasses: string) => getAccentClassForColor(accentColor, tailwindClasses), [accentColor]);

    const setShowConsoleProxy = useCallback((val: boolean) => {
        setShowConsole(val);
    }, [setShowConsole]);

    // Sync console window state with state
    useEffect(() => {
        if (showConsole) {
            window.windowControls?.openConsole();
        } else {
            window.windowControls?.closeConsole();
        }
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
            downloadProvider, setDownloadProvider,
            autoDownloadThreads, setAutoDownloadThreads,
            downloadThreads, setDownloadThreads,
            maxSockets, setMaxSockets,
            uiMode, setUIMode,
            t,
            getAccentStyles,
            getAccentClass,
            getAccentHex,
            customTheme,
            activeThemeConfig,
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
