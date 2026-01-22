import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { cn } from '../utils/cn';

const COLORS = [
    { id: 'emerald', class: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { id: 'blue', class: 'bg-blue-500', ring: 'ring-blue-500' },
    { id: 'purple', class: 'bg-purple-500', ring: 'ring-purple-500' },
    { id: 'orange', class: 'bg-orange-500', ring: 'ring-orange-500' },
    { id: 'rose', class: 'bg-rose-500', ring: 'ring-rose-500' },
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
        javaPath, setJavaPath,
        getAccentStyles
    } = useSettings();

    const isPreset = (c: string) => COLORS.some(col => col.id === c);
    const isCustom = !isPreset(accentColor);

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={t('settings.title')}
            className="max-w-2xl"
        >
            <div className="space-y-8">
                {/* Appearance */}
                <section className="space-y-4">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 pb-2">
                        {t('settings.appearance')}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Accent Color */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                                {t('settings.accent')}
                            </label>
                            <div className="flex gap-3 flex-wrap items-center">
                                {COLORS.map((c) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setAccentColor(c.id as any)}
                                        className={cn(
                                            "w-8 h-8 rounded-full transition-all ring-offset-2 ring-offset-white dark:ring-offset-zinc-800 focus:outline-none",
                                            c.class,
                                            accentColor === c.id ? `ring-2 ${c.ring} scale-110` : "opacity-60 hover:opacity-100"
                                        )}
                                        title={c.id}
                                    />
                                ))}

                                {/* Custom Color Picker */}
                                <div className="relative group w-8 h-8">
                                    <div className={cn(
                                        "w-full h-full rounded-full flex items-center justify-center transition-all ring-offset-2 ring-offset-white dark:ring-offset-zinc-800 cursor-pointer overflow-hidden",
                                        isCustom ? "ring-2 ring-zinc-500 scale-110" : "bg-zinc-200 dark:bg-zinc-800 opacity-60 group-hover:opacity-100"
                                    )}>
                                        {isCustom ? (
                                            <div className="w-full h-full" style={{ backgroundColor: accentColor }} />
                                        ) : (
                                            <span className="text-base font-light text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">+</span>
                                        )}
                                    </div>
                                    <input
                                        type="color"
                                        value={isCustom ? accentColor : '#10b981'}
                                        onChange={(e) => setAccentColor(e.target.value)}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                        title="Custom Color"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Theme */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                                {t('settings.theme')}
                            </label>
                            <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                {['light', 'dark'].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setTheme(m as 'light' | 'dark')}
                                        className={cn(
                                            "flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-all",
                                            theme === m
                                                ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                                                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                        )}
                                    >
                                        {m === 'light' ? t('settings.theme_light') : t('settings.theme_dark')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Language */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                            {t('settings.language')}
                        </label>
                        <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            {['en', 'ru'].map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => setLanguage(lang as any)}
                                    className={cn(
                                        "flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-all",
                                        language === lang
                                            ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white"
                                            : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                    )}
                                >
                                    {lang === 'en' ? 'English' : 'Русский'}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Game Settings */}
                <section className="space-y-4">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 pb-2">
                        {t('settings.java')}
                    </h4>

                    <div className="space-y-6">
                        {/* Memory */}
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                                    {t('settings.ram')}
                                </label>
                                <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">{ram} GB</span>
                            </div>
                            <input
                                type="range"
                                min="1" max="16" step="0.5"
                                value={ram}
                                onChange={(e) => setRam(parseFloat(e.target.value))}
                                className={cn("w-full", getAccentStyles('accent').className)}
                                style={getAccentStyles('accent').style}
                            />
                            <div className="flex justify-between text-[10px] text-zinc-400">
                                <span>1 GB</span>
                                <span>8 GB</span>
                                <span>16 GB</span>
                            </div>
                        </div>

                        <Input
                            label={t('settings.java_path')}
                            value={javaPath}
                            onChange={(e) => setJavaPath(e.target.value)}
                            placeholder="Default (Autodetect)"
                        />
                    </div>
                </section>

                {/* Launcher Behavior */}
                <section className="space-y-4 pt-2">
                    <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.performance')}</p>
                            <p className="text-xs text-zinc-500">{t('settings.performance_desc')}</p>
                        </div>
                        <input
                            type="checkbox"
                            checked={hideLauncher}
                            onChange={(e) => setHideLauncher(e.target.checked)}
                            className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.console')}</p>
                        <input
                            type="checkbox"
                            checked={showConsole}
                            onChange={(e) => setShowConsole(e.target.checked)}
                            className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
                        />
                    </div>
                </section>

                {/* Footer Actions */}
                <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <Button
                        onClick={onClose}
                        className={cn("text-white", getAccentStyles('bg').className)}
                        style={getAccentStyles('bg').style}
                    >
                        {t('settings.done')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default SettingsPage;
