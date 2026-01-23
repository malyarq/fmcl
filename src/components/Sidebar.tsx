import React from 'react';
import pkg from '../../package.json';
import { useSettings } from '../contexts/SettingsContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { cn } from '../utils/cn';
import { MCVersion } from '../hooks/useVersions';
import { VersionHint } from '../utils/minecraftVersions';

interface SidebarProps {
    nickname: string;
    setNickname: (name: string) => void;
    version: string;
    setVersion: (v: string) => void;
    versions: MCVersion[];
    useForge: boolean;
    setUseForge: (val: boolean) => void;
    useFabric: boolean;
    setUseFabric: (val: boolean) => void;
    useOptiFine: boolean;
    setUseOptiFine: (val: boolean) => void;
    useNeoForge: boolean;
    setUseNeoForge: (val: boolean) => void;
    isOffline: boolean;
    isLaunching: boolean;
    progress: number;
    statusText: string;
    onLaunch: () => void;
    onShowMultiplayer: () => void;
    onShowSettings: () => void;
    currentHint: VersionHint | null;
    forgeSupportedVersions: string[];
    fabricSupportedVersions: string[];
    optiFineSupportedVersions: string[];
    neoForgeSupportedVersions: string[];
}

// Left panel with launch controls and quick settings access.
const Sidebar: React.FC<SidebarProps> = ({
    nickname, setNickname,
    version, setVersion, versions,
    useForge, setUseForge,
    useFabric, setUseFabric,
    useOptiFine, setUseOptiFine,
    useNeoForge, setUseNeoForge,
    isOffline,
    isLaunching, progress, statusText,
    onLaunch, onShowMultiplayer, onShowSettings,
    currentHint,
    forgeSupportedVersions,
    fabricSupportedVersions,
    optiFineSupportedVersions,
    neoForgeSupportedVersions
}) => {
    const { getAccentStyles, getAccentHex, t } = useSettings();

    const isForgeSupported = forgeSupportedVersions.includes(version);
    const isFabricSupported = fabricSupportedVersions.includes(version);
    const isOptiFineSupported = optiFineSupportedVersions.includes(version);
    const isNeoForgeSupported = neoForgeSupportedVersions.includes(version);

    const accentStyle = getAccentStyles('bg').style || {};

    return (
        <div className="w-80 flex flex-col p-6 bg-gradient-to-b from-zinc-200/95 to-zinc-300/50 dark:from-zinc-800 dark:to-zinc-900/80 backdrop-blur-sm border-r border-zinc-300/50 dark:border-zinc-700/50 shadow-2xl shadow-black/10 dark:shadow-black/30 z-10 relative">

            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1
                        className={cn("text-2xl font-black tracking-tighter drop-shadow-sm", getAccentStyles('text').className)}
                        style={{
                            ...getAccentStyles('text').style,
                            textShadow: `0 2px 8px ${getAccentHex()}30`,
                        }}
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

                {/* Modloader Selection */}
                {(() => {
                    const availableModloaders: Array<{ id: 'neoforge' | 'forge' | 'fabric'; label: string; isActive: boolean }> = [];
                    
                    if (isNeoForgeSupported) {
                        availableModloaders.push({ id: 'neoforge', label: t('neoforge.enable'), isActive: useNeoForge });
                    }
                    if (isForgeSupported) {
                        availableModloaders.push({ id: 'forge', label: t('forge.enable'), isActive: useForge });
                    }
                    if (isFabricSupported) {
                        availableModloaders.push({ id: 'fabric', label: t('fabric.enable'), isActive: useFabric });
                    }

                    if (availableModloaders.length === 0) {
                        return null;
                    }

                    // Если доступен только один модлоадер - показываем кнопку
                    if (availableModloaders.length === 1) {
                        const loader = availableModloaders[0];
                        return (
                            <Button
                                onClick={() => {
                                    if (loader.id === 'neoforge') {
                                        setUseNeoForge(!useNeoForge);
                                    } else if (loader.id === 'forge') {
                                        setUseForge(!useForge);
                                    } else if (loader.id === 'fabric') {
                                        setUseFabric(!useFabric);
                                    }
                                }}
                                variant={loader.isActive ? 'primary' : 'secondary'}
                                className={cn(
                                    "w-full justify-center",
                                    loader.isActive && getAccentStyles('bg').className
                                )}
                                style={loader.isActive ? getAccentStyles('bg').style : undefined}
                            >
                                {loader.label}
                            </Button>
                        );
                    }

                    // Если доступно несколько модлоадеров - показываем свитчер
                    return (
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                                {t('general.modloader') || 'Modloader'}
                            </label>
                            <div className="flex bg-zinc-100/80 dark:bg-zinc-900/50 backdrop-blur-sm p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-inner">
                                {availableModloaders.map((loader) => {
                                    const isActive = loader.isActive;
                                    return (
                                        <button
                                            key={loader.id}
                                            onClick={() => {
                                                // Если кликнули на уже активный - отключаем его
                                                if (isActive) {
                                                    setUseNeoForge(false);
                                                    setUseForge(false);
                                                    setUseFabric(false);
                                                } else {
                                                    // Отключаем все модлоадеры
                                                    setUseNeoForge(false);
                                                    setUseForge(false);
                                                    setUseFabric(false);
                                                    
                                                    // Включаем выбранный
                                                    if (loader.id === 'neoforge') {
                                                        setUseNeoForge(true);
                                                    } else if (loader.id === 'forge') {
                                                        setUseForge(true);
                                                    } else if (loader.id === 'fabric') {
                                                        setUseFabric(true);
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all",
                                                isActive
                                                    ? cn("bg-white/90 dark:bg-zinc-700/90 backdrop-blur-sm shadow-md text-zinc-900 dark:text-white", getAccentStyles('bg').className)
                                                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                            )}
                                            style={isActive ? getAccentStyles('bg').style : undefined}
                                        >
                                            {loader.id === 'neoforge' ? 'NeoForge' : loader.id === 'forge' ? 'Forge' : 'Fabric'}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* OptiFine Button - только для Forge */}
                {isOptiFineSupported && useForge && (
                    <Button
                        onClick={() => setUseOptiFine(!useOptiFine)}
                        variant={useOptiFine ? 'primary' : 'secondary'}
                        className={cn(
                            "w-full justify-center",
                            useOptiFine && getAccentStyles('bg').className
                        )}
                        style={useOptiFine ? getAccentStyles('bg').style : undefined}
                    >
                        {t('optifine.enable')}
                    </Button>
                )}
            </div>

            <div className="space-y-4 mt-8 pb-4">
                <div className="text-center text-xs font-medium text-zinc-500 min-h-[1.25rem] animate-pulse">
                    {statusText}
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={onLaunch}
                        disabled={isLaunching}
                        className={cn(
                            "flex-1 py-4 text-base uppercase tracking-widest shadow-2xl transition-all",
                            isLaunching
                                ? 'bg-zinc-300 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400 cursor-not-allowed shadow-none'
                                : cn('text-white hover:brightness-110 active:scale-[0.98] hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]', getAccentStyles('bg').className)
                        )}
                        style={!isLaunching ? {
                            ...accentStyle,
                            boxShadow: `0 10px 30px ${getAccentHex()}40, 0 0 20px ${getAccentHex()}20`,
                        } : {}}
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
