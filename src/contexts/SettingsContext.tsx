import React, { createContext, useContext, useState } from 'react';

// Allow generic string for hex colors, but we can keep the union for documentation or presets if needed
type AccentColor = string;

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
    installOptifine: boolean;
    setInstallOptifine: (val: boolean) => void;
    getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover') => { className?: string; style?: React.CSSProperties };
    getAccentClass: (tailwindClasses: string) => string;
}

const SettingsContext = createContext<SettingsState | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Load from localStorage or defaults
    const [ram, setRamState] = useState(() => parseFloat(localStorage.getItem('settings_ram') || '4'));
    const [javaPath, setJavaPathState] = useState(() => localStorage.getItem('settings_javaPath') || '');
    const [hideLauncher, setHideLauncherState] = useState(() => localStorage.getItem('settings_hideLauncher') === 'true');
    const [accentColor, setAccentColorState] = useState<AccentColor>(() => localStorage.getItem('settings_accentColor') || 'emerald');
    const [showConsole, setShowConsoleState] = useState(() => localStorage.getItem('settings_showConsole') !== 'false');
    const [installOptifine, setInstallOptifineState] = useState(() => localStorage.getItem('settings_installOptifine') === 'true');

    // Persist changes
    const setRam = (val: number) => { setRamState(val); localStorage.setItem('settings_ram', val.toString()); };
    const setJavaPath = (val: string) => { setJavaPathState(val); localStorage.setItem('settings_javaPath', val); };
    const setHideLauncher = (val: boolean) => { setHideLauncherState(val); localStorage.setItem('settings_hideLauncher', val.toString()); };
    const setAccentColor = (val: AccentColor) => { setAccentColorState(val); localStorage.setItem('settings_accentColor', val); };
    const setShowConsole = (val: boolean) => { setShowConsoleState(val); localStorage.setItem('settings_showConsole', val.toString()); };
    const setInstallOptifine = (val: boolean) => { setInstallOptifineState(val); localStorage.setItem('settings_installOptifine', val.toString()); };

    // Helper: Is this a preset tailwind color?
    const isPreset = (color: string) => ['emerald', 'blue', 'purple', 'orange', 'rose'].includes(color);

    const getAccentStyles = (type: 'bg' | 'text' | 'border' | 'ring' | 'hover') => {
        const color = accentColor || 'emerald';

        if (isPreset(color)) {
            const colors: any = {
                emerald: {
                    bg: 'bg-emerald-600 hover:bg-emerald-500',
                    text: 'text-emerald-400',
                    border: 'focus:border-emerald-500',
                    hover: 'hover:text-emerald-300',
                    ring: 'focus:ring-emerald-500/20'
                },
                blue: {
                    bg: 'bg-blue-600 hover:bg-blue-500',
                    text: 'text-blue-400',
                    border: 'focus:border-blue-500',
                    hover: 'hover:text-blue-300',
                    ring: 'focus:ring-blue-500/20'
                },
                purple: {
                    bg: 'bg-purple-600 hover:bg-purple-500',
                    text: 'text-purple-400',
                    border: 'focus:border-purple-500',
                    hover: 'hover:text-purple-300',
                    ring: 'focus:ring-purple-500/20'
                },
                orange: {
                    bg: 'bg-orange-600 hover:bg-orange-500',
                    text: 'text-orange-400',
                    border: 'focus:border-orange-500',
                    hover: 'hover:text-orange-300',
                    ring: 'focus:ring-orange-500/20'
                },
                rose: {
                    bg: 'bg-rose-600 hover:bg-rose-500',
                    text: 'text-rose-400',
                    border: 'focus:border-rose-500',
                    hover: 'hover:text-rose-300',
                    ring: 'focus:ring-rose-500/20'
                },
            };
            const c = colors[color] || colors.emerald;
            return { className: c[type] || '' };
        }

        // Custom Hex Logic
        if (type === 'bg') return { style: { backgroundColor: color } };
        if (type === 'text') return { style: { color: color } };
        if (type === 'border') return { style: { borderColor: color } };
        return {};
    };

    // Helper: Replace placeholder 'XXX' with active color if preset, otherwise Apply inline style mostly handled by caller getting style object
    // But for simple class replacements:
    const getAccentClass = (tailwindClasses: string) => {
        if (isPreset(accentColor)) {
            return tailwindClasses.replace(/XXX/g, accentColor);
        }
        // If custom hex, we can't easily map 'bg-XXX-600' to hex without inline styles.
        // For now, return empty or default and let caller use style={...} property if possible,
        // or just accept that custom hexes might lose some hover states in complex components unless refactored.
        // However, for MultiplayerPage we used bg-XXX-600. Let's try to handle it.
        return tailwindClasses.replace(/XXX/g, 'emerald'); // Fallback for class names, rely on style override
    };

    return (
        <SettingsContext.Provider value={{
            ram, setRam,
            javaPath, setJavaPath,
            hideLauncher, setHideLauncher,
            accentColor, setAccentColor,
            showConsole, setShowConsole,
            installOptifine, setInstallOptifine,
            getAccentStyles,
            getAccentClass
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used within a SettingsProvider');
    return context;
};
