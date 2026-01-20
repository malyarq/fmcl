import React from 'react';
import { useSettings } from '../contexts/SettingsContext';

const COLORS = [
    { id: 'emerald', class: 'bg-emerald-500', hover: 'hover:bg-emerald-400', ring: 'ring-emerald-500' },
    { id: 'blue', class: 'bg-blue-500', hover: 'hover:bg-blue-400', ring: 'ring-blue-500' },
    { id: 'purple', class: 'bg-purple-500', hover: 'hover:bg-purple-400', ring: 'ring-purple-500' },
    { id: 'orange', class: 'bg-orange-500', hover: 'hover:bg-orange-400', ring: 'ring-orange-500' },
    { id: 'rose', class: 'bg-rose-500', hover: 'hover:bg-rose-400', ring: 'ring-rose-500' },
];

interface SettingsPageProps {
    onClose: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const {
        ram, setRam,
        hideLauncher, setHideLauncher,
        accentColor, setAccentColor,
        showConsole, setShowConsole,
        language, setLanguage, t,
        theme, setTheme,
        javaPath, setJavaPath
    } = useSettings();

    // Helper to get dynamic classes based on accent
    const isPreset = (c: string) => COLORS.some(col => col.id === c);

    // For local usage in SettingsPage, we can replicate similar logic or just use inline styles
    // Since this page is simpler, let's just use inline styles for the "done" button to match custom color
    // and for the header icon.

    // Actually, let's keep it consistent.
    const getAccentStyle = () => {
        if (isPreset(accentColor)) {
            // Basic map for just text color here
            const map: any = {
                emerald: 'text-emerald-400',
                blue: 'text-blue-400',
                purple: 'text-purple-400',
                orange: 'text-orange-400',
                rose: 'text-rose-400'
            };
            return { className: map[accentColor] || map.emerald };
        }
        return { style: { color: accentColor } };
    };

    return (
        <div className="absolute inset-0 z-40 bg-zinc-200/95 dark:bg-zinc-900/95 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-full">

                {/* Header */}
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/50">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                        <span className={getAccentStyle().className || ''} style={getAccentStyle().style}>⚙️</span> {t('settings.title')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-8 text-zinc-900 dark:text-zinc-100">

                    {/* Appearance Section */}
                    <section>
                        <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-500 uppercase tracking-wider mb-4">{t('settings.appearance')}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-zinc-500 dark:text-zinc-400 text-xs mb-3">{t('settings.accent')}</label>
                                <div className="flex gap-4 items-center">
                                    {COLORS.map((c) => (
                                        <button
                                            key={c.id}
                                            onClick={() => setAccentColor(c.id as any)}
                                            className={`w-8 h-8 rounded-full transition-all duration-300 ${c.class} ${c.hover} ${accentColor === c.id ? `ring-2 ring-offset-2 ring-offset-zinc-200 dark:ring-offset-zinc-800 ${c.ring} scale-110` : 'opacity-70 hover:opacity-100'}`}
                                            title={c.id.charAt(0).toUpperCase() + c.id.slice(1)}
                                        />
                                    ))}

                                    {/* Custom Color Picker */}
                                    <div className="relative group ml-2 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full overflow-hidden relative ring-2 ring-zinc-300 dark:ring-zinc-700 group-hover:ring-zinc-500 transition-all">
                                            <input
                                                type="color"
                                                value={!isPreset(accentColor) ? accentColor : '#10b981'}
                                                onChange={(e) => setAccentColor(e.target.value)}
                                                className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -left-1/4 cursor-pointer p-0 border-0"
                                            />
                                        </div>
                                        {!isPreset(accentColor) && (
                                            <span className="text-[10px] font-mono text-zinc-500 uppercase">{accentColor}</span>
                                        )}
                                        <span className="text-[10px] text-zinc-600 absolute -bottom-5 left-0 w-max opacity-0 group-hover:opacity-100 transition-opacity">Custom</span>
                                    </div>
                                </div>
                            </div>

                            {/* Language Selector */}
                            <div>
                                <label className="block text-zinc-500 dark:text-zinc-400 text-xs mb-3">{t('settings.language')}</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors border ${language === 'en' ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white border-zinc-400 dark:border-zinc-500 shadow-md' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                    >
                                        English
                                    </button>
                                    <button
                                        onClick={() => setLanguage('ru')}
                                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors border ${language === 'ru' ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white border-zinc-400 dark:border-zinc-500 shadow-md' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                    >
                                        Русский
                                    </button>
                                </div>
                            </div>

                            {/* Theme Selector */}
                            <div>
                                <label className="block text-zinc-500 dark:text-zinc-400 text-xs mb-3">{t('settings.theme')}</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors border ${theme === 'dark' ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white border-zinc-400 dark:border-zinc-500 shadow-md' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                    >
                                        {t('settings.theme_dark')}
                                    </button>
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`px-3 py-1.5 rounded text-xs font-bold uppercase transition-colors border ${theme === 'light' ? 'bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white border-zinc-400 dark:border-zinc-500 shadow-md' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'}`}
                                    >
                                        {t('settings.theme_light')}
                                    </button>
                                </div>
                            </div>


                            <div className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-zinc-900/50 rounded border border-zinc-200 dark:border-zinc-700/50">
                                <span className="text-zinc-700 dark:text-zinc-300 text-sm">{t('settings.console')}</span>
                                <input
                                    type="checkbox"
                                    checked={showConsole}
                                    onChange={(e) => setShowConsole(e.target.checked)}
                                    className="w-4 h-4 rounded accent-current"
                                    style={!isPreset(accentColor) ? { accentColor: accentColor } : {}}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Java & Performance Section */}
                    <section>
                        <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4">{t('settings.java')}</h3>
                        <div className="space-y-6">
                            {/* RAM Slider */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-zinc-500 dark:text-zinc-400 text-xs">{t('settings.ram')}</label>
                                    <span className={`text-xs font-bold ${getAccentStyle().className || ''}`} style={getAccentStyle().style}>{ram} GB</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="16"
                                    step="0.5"
                                    value={ram}
                                    onChange={(e) => setRam(parseFloat(e.target.value))}
                                    className={`w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer ${isPreset(accentColor) ? `accent-${accentColor}-500` : ''}`}
                                    style={!isPreset(accentColor) ? { accentColor: accentColor } : {}}
                                />
                                <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">
                                    <span>1 GB (Low)</span>
                                    <span>8 GB (Recommended)</span>
                                    <span>16 GB (Extreme)</span>
                                </div>
                            </div>

                            {/* Performance Mode */}
                            <div className="flex items-center justify-between p-3 bg-zinc-100 dark:bg-zinc-900/50 rounded border border-zinc-200 dark:border-zinc-700/50">
                                <div>
                                    <p className="text-zinc-700 dark:text-zinc-300 text-sm font-medium">{t('settings.performance')}</p>
                                    <p className="text-zinc-500 text-xs">{t('settings.performance_desc')}</p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={hideLauncher}
                                    onChange={(e) => setHideLauncher(e.target.checked)}
                                    className="w-5 h-5 rounded cursor-pointer accent-current"
                                    style={!isPreset(accentColor) ? { accentColor: accentColor } : {}}
                                />
                            </div>



                            {/* Java Path Override */}
                            <div>
                                <label className="block text-zinc-500 dark:text-zinc-400 text-xs mb-2">{t('settings.java_path')}</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={javaPath}
                                        onChange={(e) => setJavaPath(e.target.value)}
                                        placeholder={!javaPath ? "Default (Bundled Java 8)" : ""}
                                        className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-3 py-2 text-xs text-zinc-800 dark:text-zinc-300 focus:outline-none focus:border-zinc-500 font-mono"
                                    />
                                    <button
                                        // Placeholder for browse logic 
                                        className="hidden"
                                    ></button>
                                </div>
                                <p className="text-[10px] text-zinc-500 dark:text-zinc-600 mt-1">{t('settings.java_path_desc')}</p>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="p-6 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white rounded text-sm font-medium transition-colors`}
                    >
                        {t('settings.done')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
