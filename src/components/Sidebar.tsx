import React from 'react';
import pkg from '../../package.json';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { cn } from '../utils/cn';

interface SidebarProps {
    nickname: string;
    setNickname: (name: string) => void;
    version: string;
    setVersion: (v: string) => void;
    versions: any[];
    useForge: boolean;
    setUseForge: (val: boolean) => void;
    isOffline: boolean;
    isLaunching: boolean;
    progress: number;
    statusText: string;
    onLaunch: () => void;
    onShowMultiplayer: () => void;
    onShowSettings: () => void;
    currentHint: any;
}

const Sidebar: React.FC<SidebarProps> = ({
    nickname, setNickname,
    version, setVersion, versions,
    useForge, setUseForge,
    isOffline,
    isLaunching, progress, statusText,
    onLaunch, onShowMultiplayer, onShowSettings,
    currentHint
}) => {
    const { getAccentStyles, t } = useSettings();

    const accentStyle = getAccentStyles('bg').style || {};

    return (
        <div className="w-80 flex flex-col p-6 bg-zinc-200 dark:bg-zinc-800 border-r border-zinc-300 dark:border-zinc-700 shadow-xl z-10 relative">

            {/* Header Area */}
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1
                        className={cn("text-2xl font-bold tracking-tighter", getAccentStyles('text').className)}
                        style={getAccentStyles('text').style}
                    >
                        FriendLauncher
                    </h1>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1 opacity-70">BUILD v{pkg.version}</p>
                </div>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onShowMultiplayer}
                        className="px-2"
                        title="Multiplayer (Tunnel)"
                    >
                        <span className="text-lg">🌐</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onShowSettings}
                        className="px-2"
                        title="Settings"
                    >
                        <span className="text-lg">⚙️</span>
                    </Button>
                </div>
            </div>

            <div className="space-y-6 flex-1 flex flex-col pt-2">
                {/* Nickname Input */}
                <div className="relative">
                    <div className="flex justify-between items-center mb-1">
                        {isOffline && (
                            <span className="absolute top-0 right-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-800/50 uppercase tracking-wider z-10">
                                {t('general.offline')}
                            </span>
                        )}
                    </div>
                    <Input
                        label={t('general.nickname')}
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Steve"
                        className="bg-white dark:bg-zinc-900"
                    />
                </div>

                {/* Version Selector */}
                <div>
                    <Select
                        label={t('general.version')}
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="font-mono"
                    >
                        {versions.map(v => (
                            <option key={v.id} value={v.id}>{v.id}</option>
                        ))}
                    </Select>

                    {currentHint && (
                        <div
                            className={cn("text-xs mt-2 font-medium px-2 py-1 rounded bg-black/5 dark:bg-white/5", currentHint.className)}
                            style={currentHint.style}
                        >
                            {currentHint.text}
                        </div>
                    )}
                </div>

                {/* Forge Toggle */}
                <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900/50 p-3 rounded-lg border border-zinc-300 dark:border-zinc-700/50 transition-colors hover:border-zinc-400 dark:hover:border-zinc-600">
                    <div className="relative flex items-center">
                        <input
                            type="checkbox"
                            id="forge-toggle"
                            checked={useForge}
                            onChange={(e) => setUseForge(e.target.checked)}
                            className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-zinc-400 dark:border-zinc-600 checked:bg-zinc-800 dark:checked:bg-white checked:border-transparent transition-all"
                        />
                        <svg className="absolute w-3.5 h-3.5 text-white dark:text-black pointer-events-none opacity-0 peer-checked:opacity-100 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <label htmlFor="forge-toggle" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none flex-1">
                        {t('forge.enable')}
                    </label>
                </div>
            </div>

            {/* Launch Controls */}
            <div className="space-y-4 mt-8 pb-4">
                <div className="text-center text-xs font-medium text-zinc-500 min-h-[1.25rem] animate-pulse">
                    {statusText}
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={onLaunch}
                        disabled={isLaunching}
                        className={cn(
                            "flex-1 py-4 text-base uppercase tracking-widest shadow-xl",
                            isLaunching
                                ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed shadow-none'
                                : cn('text-white hover:brightness-110 active:scale-[0.98]', getAccentStyles('bg').className)
                        )}
                        style={!isLaunching ? accentStyle : {}}
                        progress={isLaunching ? progress : undefined}
                    >
                        {isLaunching ? t('general.running') : t('general.play')}
                    </Button>

                    {isLaunching && (
                        <Button
                            variant="danger"
                            onClick={() => window.location.reload()}
                            className="px-3"
                            title="Force Restart"
                        >
                            ✕
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
