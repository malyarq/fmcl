import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import type { AccentColor, AccentStyleType, DownloadProvider, Language, Theme, UIMode } from './settings/types';
import {
  deserializeBoolean,
  deserializeInt,
  deserializeString,
  serializeBoolean,
  serializeInt,
  serializeString,
  useLocalStorageState,
} from './settings/persistence';
import { applyThemeToDocument } from './settings/theme';
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
    t: (key: string) => string;
    getAccentStyles: (type: AccentStyleType) => { className?: string; style?: React.CSSProperties };
    getAccentClass: (tailwindClasses: string) => string;
    getAccentHex: () => string;
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
    const [downloadProvider, setDownloadProvider] = useLocalStorageState<DownloadProvider>('settings_downloadProvider', (raw) => (raw === 'mojang' || raw === 'bmcl' ? raw : 'auto'), serializeString);
    const [autoDownloadThreads, setAutoDownloadThreads] = useLocalStorageState('settings_autoDownloadThreads', deserializeBoolean(true), serializeBoolean);
    const [downloadThreads, setDownloadThreads] = useLocalStorageState('settings_downloadThreads', deserializeInt(8), serializeInt);
    const [maxSockets, setMaxSockets] = useLocalStorageState('settings_maxSockets', deserializeInt(64), serializeInt);
    // UI mode: simple play vs modpacks, persisted across sessions.
    const [uiMode, setUIMode] = useLocalStorageState<UIMode>(
        'settings_uiMode',
        (raw) => (raw === 'modpacks' ? 'modpacks' : 'simple'),
        serializeString,
    );

    useEffect(() => {
        applyThemeToDocument(theme);
    }, [theme]);

    const t = useMemo(() => createTranslator(language), [language]);

    const getAccentHex = useCallback(() => getAccentHexForColor(accentColor), [accentColor]);
    const getAccentStyles = useCallback(
      (type: AccentStyleType) => getAccentStylesForColor(accentColor, type, theme),
      [accentColor, theme]
    );
    const getAccentClass = useCallback((tailwindClasses: string) => getAccentClassForColor(accentColor, tailwindClasses), [accentColor]);

    return (
        <SettingsContext.Provider value={{
            minecraftPath, setMinecraftPath,
            hideLauncher, setHideLauncher,
            accentColor, setAccentColor,
            showConsole, setShowConsole,
            language, setLanguage,
            theme, setTheme,
            downloadProvider, setDownloadProvider,
            autoDownloadThreads, setAutoDownloadThreads,
            downloadThreads, setDownloadThreads,
            maxSockets, setMaxSockets,
            uiMode, setUIMode,
            t,
            getAccentStyles,
            getAccentClass,
            getAccentHex
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
export const useUIMode = () => {
    const { uiMode, setUIMode } = useSettings();
    return {
        uiMode,
        setMode: setUIMode,
    };
};
