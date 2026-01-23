import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useAppUpdater } from '../hooks/useAppUpdater';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { UpdateModal } from './UpdateModal';
import { cn } from '../utils/cn';

const COLORS = [
    { id: 'emerald', class: 'bg-emerald-500', ring: 'ring-emerald-500' },
    { id: 'blue', class: 'bg-blue-500', ring: 'ring-blue-500' },
    { id: 'purple', class: 'bg-purple-500', ring: 'ring-purple-500' },
    { id: 'orange', class: 'bg-orange-500', ring: 'ring-orange-500' },
    { id: 'rose', class: 'bg-rose-500', ring: 'ring-rose-500' },
];

type TabId = 'appearance' | 'game' | 'downloads' | 'launcher';

interface SettingsPageProps {
    onClose: () => void;
}

// Settings modal for appearance and launcher preferences.
const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<TabId>('appearance');
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const {
        ram, setRam,
        hideLauncher, setHideLauncher,
        accentColor, setAccentColor,
        showConsole, setShowConsole,
        language, setLanguage, t,
        theme, setTheme,
        javaPath, setJavaPath,
        minecraftPath, setMinecraftPath,
        downloadProvider, setDownloadProvider,
        autoDownloadThreads, setAutoDownloadThreads,
        downloadThreads, setDownloadThreads,
        maxSockets, setMaxSockets,
        getAccentStyles
    } = useSettings();

    // App updater hook (without auto-check)
    const { status, updateInfo, progress, checkForUpdates, installUpdate } = useAppUpdater(false);

    // Show update modal when update becomes available
    React.useEffect(() => {
        if (status === 'available' || status === 'downloading' || status === 'downloaded') {
            setShowUpdateModal(true);
        }
    }, [status]);

    // Preset palette is used to keep Tailwind classes static (prevents purging).
    const isPreset = (c: string) => COLORS.some(col => col.id === c);
    const isCustom = !isPreset(accentColor);

    const tabs: { id: TabId; label: string }[] = [
        { id: 'appearance', label: t('settings.tab_appearance') },
        { id: 'game', label: t('settings.tab_game') },
        { id: 'downloads', label: t('settings.tab_downloads') },
        { id: 'launcher', label: t('settings.tab_launcher') },
    ];

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={t('settings.title')}
            className="max-w-2xl"
        >
            <div className="space-y-4">
                <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 -mx-6 px-6">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const accentBorderStyle = isActive ? getAccentStyles('border').style : undefined;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-[1px]",
                                    isActive
                                        ? "text-zinc-900 dark:text-white"
                                        : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                )}
                                style={accentBorderStyle}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                <div>
                    {activeTab === 'appearance' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
                                        {t('settings.accent')}
                                    </label>
                                    <div className="flex gap-3 flex-wrap items-center">
                                        {COLORS.map((c) => (
                                            <button
                                                key={c.id}
                                                onClick={() => setAccentColor(c.id)}
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
                                                    <span className="text-base text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">+</span>
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

                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
                                        {t('settings.theme')}
                                    </label>
                                    <div className="flex bg-zinc-100/80 dark:bg-zinc-900/50 backdrop-blur-sm p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-inner">
                                        {['light', 'dark'].map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => setTheme(m as 'light' | 'dark')}
                                                className={cn(
                                                    "flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all",
                                                    theme === m
                                                        ? "bg-white/90 dark:bg-zinc-700/90 backdrop-blur-sm shadow-md text-zinc-900 dark:text-white"
                                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                                )}
                                            >
                                                {m === 'light' ? t('settings.theme_light') : t('settings.theme_dark')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
                                    {t('settings.language')}
                                </label>
                                <div className="flex bg-zinc-100 dark:bg-zinc-900/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                    {['en', 'ru'].map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => setLanguage(lang as 'en' | 'ru')}
                                                className={cn(
                                                    "flex-1 py-1.5 text-xs font-bold uppercase rounded-lg transition-all",
                                                    language === lang
                                                        ? "bg-white/90 dark:bg-zinc-700/90 backdrop-blur-sm shadow-md text-zinc-900 dark:text-white"
                                                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                                )}
                                        >
                                            {lang === 'en' ? 'English' : 'Русский'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'game' && (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex justify-between mb-2">
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

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 block">
                                    {t('settings.minecraft_path')}
                                </label>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1 min-w-0">
                                        <Input
                                            value={minecraftPath}
                                            onChange={(e) => setMinecraftPath(e.target.value)}
                                            placeholder={t('settings.minecraft_path_placeholder')}
                                            containerClassName="mb-0 gap-0"
                                        />
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button
                                            onClick={async () => {
                                                try {
                                                    const result = await window.settings.selectMinecraftPath();
                                                    if (result.success && result.path) {
                                                        setMinecraftPath(result.path);
                                                    }
                                                } catch (error) {
                                                    const errorMessage = error instanceof Error ? error.message : String(error);
                                                    alert('Error selecting folder: ' + errorMessage);
                                                }
                                            }}
                                            className="h-[42px]"
                                        >
                                            {t('settings.browse')}
                                        </Button>
                                        <Button
                                            onClick={async () => {
                                                try {
                                                    const pathToOpen = minecraftPath || await window.settings.getDefaultMinecraftPath();
                                                    await window.settings.openMinecraftPath(pathToOpen);
                                                } catch (error) {
                                                    const errorMessage = error instanceof Error ? error.message : String(error);
                                                    alert('Error opening folder: ' + errorMessage);
                                                }
                                            }}
                                            variant="secondary"
                                            className="h-[42px] bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                        >
                                            {t('settings.open_folder')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'downloads' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-2 block">
                                        {t('settings.download_provider')}
                                    </label>
                                    <select
                                        value={downloadProvider}
                                        onChange={(e) => setDownloadProvider(e.target.value as 'mojang' | 'bmcl' | 'auto')}
                                        className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-300/50 dark:border-zinc-700/50 rounded-lg p-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-sm hover:shadow-md transition-all"
                                    >
                                        <option value="auto">{t('settings.download_provider_auto')}</option>
                                        <option value="bmcl">{t('settings.download_provider_bmcl')}</option>
                                        <option value="mojang">{t('settings.download_provider_mojang')}</option>
                                    </select>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all">
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.download_threads_auto')}</p>
                                            <p className="text-xs text-zinc-500">{t('settings.download_threads_auto_desc')}</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={autoDownloadThreads}
                                            onChange={(e) => setAutoDownloadThreads(e.target.checked)}
                                            className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Input
                                    label={t('settings.download_threads')}
                                    type="number"
                                    min={1}
                                    value={downloadThreads}
                                    onChange={(e) => setDownloadThreads(parseInt(e.target.value || '1', 10))}
                                    placeholder="8"
                                    disabled={autoDownloadThreads}
                                />
                                <Input
                                    label={t('settings.max_sockets')}
                                    type="number"
                                    min={1}
                                    value={maxSockets}
                                    onChange={(e) => setMaxSockets(parseInt(e.target.value || '1', 10))}
                                    placeholder="64"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'launcher' && (
                        <div className="space-y-4">
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

                            <div className="flex gap-3 items-stretch">
                                <div className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800 flex flex-col">
                                    {(status === 'checking' || status === 'available' || status === 'up-to-date' || status === 'error') && (
                                        <div className="flex items-center justify-between mb-2">
                                            {status === 'checking' && (
                                                <span className="text-xs text-zinc-500">{t('updater.checking')}</span>
                                            )}
                                            {status === 'available' && updateInfo && (
                                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                                    {t('updater.available')}: {updateInfo.version}
                                                </span>
                                            )}
                                            {status === 'up-to-date' && (
                                                <span className="text-xs text-zinc-500">{t('updater.up_to_date')}</span>
                                            )}
                                            {status === 'error' && (
                                                <span className="text-xs text-red-600 dark:text-red-400">{t('updater.error')}</span>
                                            )}
                                        </div>
                                    )}
                                    <div className="mt-auto">
                                        <Button
                                            onClick={async () => {
                                                setShowUpdateModal(false);
                                                await checkForUpdates();
                                            }}
                                            disabled={status === 'checking' || status === 'downloading'}
                                            variant="secondary"
                                            className="w-full bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                        >
                                            {status === 'checking' ? t('updater.checking') : t('updater.check')}
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-900/40 rounded-lg border border-zinc-100 dark:border-zinc-800 flex flex-col">
                                    <div className="mt-auto">
                                        <Button
                                            onClick={async () => {
                                                if (window.confirm(t('settings.clear_cache_confirm'))) {
                                                    try {
                                                        const result = await window.cache.clear();
                                                        if (result.success) {
                                                            await window.cache.reload();
                                                        } else {
                                                            alert('Failed to clear cache: ' + (result.error || 'Unknown error'));
                                                        }
                                                    } catch (error) {
                                                        const errorMessage = error instanceof Error ? error.message : String(error);
                                                        alert('Error clearing cache: ' + errorMessage);
                                                    }
                                                }
                                            }}
                                            variant="secondary"
                                            className="w-full bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                                        >
                                            {t('settings.clear_cache')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

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

            <UpdateModal
                isOpen={showUpdateModal}
                onClose={() => setShowUpdateModal(false)}
                updateInfo={updateInfo}
                progress={progress}
                status={status as 'available' | 'downloading' | 'downloaded'}
                onInstall={installUpdate}
            />
        </Modal>
    );
};

export default SettingsPage;
