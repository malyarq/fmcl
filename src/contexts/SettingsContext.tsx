import React, { createContext, useContext, useEffect, useState } from 'react';

import en from '../locales/en.json';
import ru from '../locales/ru.json';

// Accent color can be a preset name or a custom hex string.
type AccentColor = string;
type Language = 'en' | 'ru';

interface SettingsState {
    ram: number;
    setRam: (val: number) => void;
    javaPath: string;
    setJavaPath: (val: string) => void;
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
    theme: 'dark' | 'light';
    setTheme: (val: 'dark' | 'light') => void;
    downloadProvider: 'mojang' | 'bmcl' | 'auto';
    setDownloadProvider: (val: 'mojang' | 'bmcl' | 'auto') => void;
    autoDownloadThreads: boolean;
    setAutoDownloadThreads: (val: boolean) => void;
    downloadThreads: number;
    setDownloadThreads: (val: number) => void;
    maxSockets: number;
    setMaxSockets: (val: number) => void;
    t: (key: string) => string;
    getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => { className?: string; style?: React.CSSProperties };
    getAccentClass: (tailwindClasses: string) => string;
    getAccentHex: () => string;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

interface Translations {
    [key: string]: string;
}

const translations: Record<Language, Translations> = { en, ru };

// Preset styles are static to prevent Tailwind purging.
const PRESET_STYLES: Record<string, Record<string, string>> = {
    emerald: {
        bg: 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
        text: 'text-emerald-500 dark:text-emerald-400',
        border: 'focus:border-emerald-500 dark:focus:border-emerald-400',
        hover: 'hover:text-emerald-600 dark:hover:text-emerald-300',
        ring: 'focus:ring-emerald-500/20',
        accent: 'accent-emerald-500 dark:accent-emerald-400',
        title: 'text-emerald-600 dark:text-emerald-400',
    },
    blue: {
        bg: 'bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 text-white',
        text: 'text-blue-500 dark:text-blue-400',
        border: 'focus:border-blue-500 dark:focus:border-blue-400',
        hover: 'hover:text-blue-600 dark:hover:text-blue-300',
        ring: 'focus:ring-blue-500/20',
        accent: 'accent-blue-500 dark:accent-blue-400',
        title: 'text-blue-600 dark:text-blue-400',
    },
    purple: {
        bg: 'bg-purple-600 hover:bg-purple-500 dark:bg-purple-600 dark:hover:bg-purple-500 text-white',
        text: 'text-purple-500 dark:text-purple-400',
        border: 'focus:border-purple-500 dark:focus:border-purple-400',
        hover: 'hover:text-purple-600 dark:hover:text-purple-300',
        ring: 'focus:ring-purple-500/20',
        accent: 'accent-purple-500 dark:accent-purple-400',
        title: 'text-purple-600 dark:text-purple-400',
    },
    orange: {
        bg: 'bg-orange-600 hover:bg-orange-500 dark:bg-orange-600 dark:hover:bg-orange-500 text-white',
        text: 'text-orange-500 dark:text-orange-400',
        border: 'focus:border-orange-500 dark:focus:border-orange-400',
        hover: 'hover:text-orange-600 dark:hover:text-orange-300',
        ring: 'focus:ring-orange-500/20',
        accent: 'accent-orange-500 dark:accent-orange-400',
        title: 'text-orange-600 dark:text-orange-400',
    },
    rose: {
        bg: 'bg-rose-600 hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500 text-white',
        text: 'text-rose-500 dark:text-rose-400',
        border: 'focus:border-rose-500 dark:focus:border-rose-400',
        hover: 'hover:text-rose-600 dark:hover:text-rose-300',
        ring: 'focus:ring-rose-500/20',
        accent: 'accent-rose-500 dark:accent-rose-400',
        title: 'text-rose-600 dark:text-rose-400',
    }
};

const PRESET_KEYS = Object.keys(PRESET_STYLES);

// Centralized UI settings with localStorage persistence.
export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [ram, setRamState] = useState(() => parseFloat(localStorage.getItem('settings_ram') || '4'));
    const [javaPath, setJavaPathState] = useState(() => localStorage.getItem('settings_javaPath') || '');
    const [minecraftPath, setMinecraftPathState] = useState(() => localStorage.getItem('settings_minecraftPath') || '');
    const [hideLauncher, setHideLauncherState] = useState(() => localStorage.getItem('settings_hideLauncher') === 'true');
    const [accentColor, setAccentColorState] = useState<AccentColor>(() => localStorage.getItem('settings_accentColor') || 'emerald');
    const [showConsole, setShowConsoleState] = useState(() => localStorage.getItem('settings_showConsole') !== 'false');
    const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('settings_language') as Language) || 'en');
    const [theme, setThemeState] = useState<'dark' | 'light'>(() => (localStorage.getItem('settings_theme') as 'dark' | 'light') || 'dark');
    const [downloadProvider, setDownloadProviderState] = useState<'mojang' | 'bmcl' | 'auto'>(() => (localStorage.getItem('settings_downloadProvider') as 'mojang' | 'bmcl' | 'auto') || 'auto');
    const [autoDownloadThreads, setAutoDownloadThreadsState] = useState(() => localStorage.getItem('settings_autoDownloadThreads') !== 'false');
    const [downloadThreads, setDownloadThreadsState] = useState(() => {
        const value = parseInt(localStorage.getItem('settings_downloadThreads') || '8', 10);
        return Number.isFinite(value) ? value : 8;
    });
    const [maxSockets, setMaxSocketsState] = useState(() => {
        const value = parseInt(localStorage.getItem('settings_maxSockets') || '64', 10);
        return Number.isFinite(value) ? value : 64;
    });

    useEffect(() => {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('dark', isDark);
        document.body.classList.toggle('dark', isDark);
    }, [theme]);

    const setRam = (val: number) => { setRamState(val); localStorage.setItem('settings_ram', val.toString()); };
    const setJavaPath = (val: string) => { setJavaPathState(val); localStorage.setItem('settings_javaPath', val); };
    const setMinecraftPath = (val: string) => { setMinecraftPathState(val); localStorage.setItem('settings_minecraftPath', val); };
    const setHideLauncher = (val: boolean) => { setHideLauncherState(val); localStorage.setItem('settings_hideLauncher', val.toString()); };
    const setAccentColor = (val: AccentColor) => { setAccentColorState(val); localStorage.setItem('settings_accentColor', val); };
    const setShowConsole = (val: boolean) => { setShowConsoleState(val); localStorage.setItem('settings_showConsole', val.toString()); };
    const setLanguage = (val: Language) => { setLanguageState(val); localStorage.setItem('settings_language', val); };
    const setTheme = (val: 'dark' | 'light') => { setThemeState(val); localStorage.setItem('settings_theme', val); };
    const setDownloadProvider = (val: 'mojang' | 'bmcl' | 'auto') => { setDownloadProviderState(val); localStorage.setItem('settings_downloadProvider', val); };
    const setAutoDownloadThreads = (val: boolean) => { setAutoDownloadThreadsState(val); localStorage.setItem('settings_autoDownloadThreads', val.toString()); };
    const setDownloadThreads = (val: number) => { setDownloadThreadsState(val); localStorage.setItem('settings_downloadThreads', val.toString()); };
    const setMaxSockets = (val: number) => { setMaxSocketsState(val); localStorage.setItem('settings_maxSockets', val.toString()); };

    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    const isPreset = (color: string) => PRESET_KEYS.includes(color);

    // Convert hex to rgba for custom colors.
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const PRESET_HEX_MAP: Record<string, string> = {
        emerald: '#10b981',
        blue: '#3b82f6',
        purple: '#a855f7',
        orange: '#f97316',
        rose: '#f43f5e'
    };

    const getAccentHex = () => {
        const color = accentColor || 'emerald';
        return isPreset(color) ? PRESET_HEX_MAP[color] : color;
    };

    const getAccentStyles = (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
        const color = accentColor || 'emerald';

        if (isPreset(color)) {
            if (type === 'soft-bg') return { className: `bg-${color}-500/10` };
            if (type === 'soft-border') return { className: `border-${color}-500/20` };
            return { className: PRESET_STYLES[color][type] || '' };
        }

        if (type === 'bg') return { style: { backgroundColor: color, color: '#fff' } };
        if (type === 'text') return { style: { color: color } };
        if (type === 'title') return { style: { color: color } };
        if (type === 'border') return { style: { borderColor: color } };
        if (type === 'accent') return { style: { accentColor: color } };
        if (type === 'soft-bg') return { style: { backgroundColor: hexToRgba(color, 0.1) } };
        if (type === 'soft-border') return { style: { borderColor: hexToRgba(color, 0.2) } };

        return {};
    };

    // Replace placeholder 'XXX' with preset colors when possible.
    const getAccentClass = (tailwindClasses: string) => {
        if (isPreset(accentColor)) {
            return tailwindClasses.replace(/XXX/g, accentColor);
        }
        return tailwindClasses.replace(/XXX/g, 'emerald');
    };

    return (
        <SettingsContext.Provider value={{
            ram, setRam,
            javaPath, setJavaPath,
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
            t,
            getAccentStyles,
            getAccentClass,
            getAccentHex
        }}>
            {children}
            {/* Hidden div to prevent Tailwind from purging preset color classes */}
            <div className={`hidden ${Object.values(PRESET_STYLES).flatMap(s => Object.values(s)).join(' ')}`} />
        </SettingsContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
