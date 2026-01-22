import React, { createContext, useContext, useState } from 'react';

import en from '../locales/en.json';
import ru from '../locales/ru.json';

// Allow generic string for hex colors
type AccentColor = string;
type Language = 'en' | 'ru';

interface SettingsState {
    ram: number;
    setRam: (val: number) => void;
    javaPath: string;
    setJavaPath: (val: string) => void;
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
    t: (key: string) => string;
    getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => { className?: string; style?: React.CSSProperties };
    getAccentClass: (tailwindClasses: string) => string;
    getAccentHex: () => string;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

const translations: Record<Language, any> = { en, ru };

// Define Presets Statically to prevent Tailwind Purging
const PRESET_STYLES: Record<string, Record<string, string>> = {
    emerald: {
        bg: 'bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white',
        text: 'text-emerald-500 dark:text-emerald-400',
        border: 'focus:border-emerald-500 dark:focus:border-emerald-400',
        hover: 'hover:text-emerald-600 dark:hover:text-emerald-300',
        ring: 'focus:ring-emerald-500/20',
        accent: 'accent-emerald-500 dark:accent-emerald-400',
        title: 'text-emerald-600 dark:text-emerald-400', // Unique title color
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

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Load from localStorage or defaults
    const [ram, setRamState] = useState(() => parseFloat(localStorage.getItem('settings_ram') || '4'));
    const [javaPath, setJavaPathState] = useState(() => localStorage.getItem('settings_javaPath') || '');
    const [hideLauncher, setHideLauncherState] = useState(() => localStorage.getItem('settings_hideLauncher') === 'true');
    const [accentColor, setAccentColorState] = useState<AccentColor>(() => localStorage.getItem('settings_accentColor') || 'emerald');
    const [showConsole, setShowConsoleState] = useState(() => localStorage.getItem('settings_showConsole') !== 'false');
    const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('settings_language') as Language) || 'en');
    const [theme, setThemeState] = useState<'dark' | 'light'>(() => (localStorage.getItem('settings_theme') as 'dark' | 'light') || 'dark');

    // Persist changes
    const setRam = (val: number) => { setRamState(val); localStorage.setItem('settings_ram', val.toString()); };
    const setJavaPath = (val: string) => { setJavaPathState(val); localStorage.setItem('settings_javaPath', val); };
    const setHideLauncher = (val: boolean) => { setHideLauncherState(val); localStorage.setItem('settings_hideLauncher', val.toString()); };
    const setAccentColor = (val: AccentColor) => { setAccentColorState(val); localStorage.setItem('settings_accentColor', val); };
    const setShowConsole = (val: boolean) => { setShowConsoleState(val); localStorage.setItem('settings_showConsole', val.toString()); };
    const setLanguage = (val: Language) => { setLanguageState(val); localStorage.setItem('settings_language', val); };
    const setTheme = (val: 'dark' | 'light') => { setThemeState(val); localStorage.setItem('settings_theme', val); };

    // Translation helper
    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    const isPreset = (color: string) => PRESET_KEYS.includes(color);

    // Helper to convert hex to rgba for custom colors
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
            // Dynamic Soft Construction for Presets to avoid massive map
            if (type === 'soft-bg') return { className: `bg-${color}-500/10` };
            if (type === 'soft-border') return { className: `border-${color}-500/20` };
            return { className: PRESET_STYLES[color][type] || '' };
        }

        // Custom Hex Logic
        if (type === 'bg') return { style: { backgroundColor: color, color: '#fff' } };
        if (type === 'text') return { style: { color: color } };
        if (type === 'title') return { style: { color: color } };
        if (type === 'border') return { style: { borderColor: color } };
        if (type === 'accent') return { style: { accentColor: color } };
        if (type === 'soft-bg') return { style: { backgroundColor: hexToRgba(color, 0.1) } };
        if (type === 'soft-border') return { style: { borderColor: hexToRgba(color, 0.2) } };

        return {};
    };

    // Helper: Replace placeholder 'XXX' with active color if preset
    const getAccentClass = (tailwindClasses: string) => {
        // Since we can't reliably replace classes dynamically without purging,
        // this method is less safe. Prefer getAccentStyles.
        // We fallback to emerald if generic replacement is requested for now.
        if (isPreset(accentColor)) {
            // This return is risky if tailwindClasses contains "bg-XXX-600"
            // but we should avoid using this method for core styling now.
            return tailwindClasses.replace(/XXX/g, accentColor);
        }
        return tailwindClasses.replace(/XXX/g, 'emerald');
    };

    return (
        <SettingsContext.Provider value={{
            ram, setRam,
            javaPath, setJavaPath,
            hideLauncher, setHideLauncher,
            accentColor, setAccentColor,
            showConsole, setShowConsole,
            language, setLanguage,
            theme, setTheme,
            t,
            getAccentStyles,
            getAccentClass,
            getAccentHex
        }}>
            {children}
            <div className={`hidden ${Object.values(PRESET_STYLES).flatMap(s => Object.values(s)).join(' ')}`} />
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
