import { useMemo, useState, useEffect } from 'react';
import pkg from '../../package.json';
import { useSettings, useUIMode } from '../contexts/SettingsContext';
import { useModpack } from '../contexts/ModpackContext';
import { loadLastGame, formatLastLaunch } from '../features/launch/services/lastGame';
import type { MCVersion } from '../services/versions/types';
import type { VersionHint } from '../utils/minecraftVersions';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { NicknameSection } from './sidebar/NicknameSection';
import { LaunchControls } from './sidebar/LaunchControls';
import { ModloaderSection } from './sidebar/ModloaderSection';
import { OptifineToggle } from './sidebar/OptifineToggle';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { cn } from '../utils/cn';

export type SidebarLaunchModel = {
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
    setLoader: (loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge') => void;
    isOffline: boolean;
    currentHint: VersionHint | null;
    supportedVersions: {
        forge: string[];
        fabric: string[];
        optiFine: string[];
        neoForge: string[];
    };
    isModloadersLoading?: boolean;
};

export type SidebarRuntimeModel = {
    isLaunching: boolean;
    progress: number;
    statusText: string;
    onLaunch: () => void;
};

interface SidebarProps {
    launch: SidebarLaunchModel;
    runtime: SidebarRuntimeModel;
    actions: {
        onShowMultiplayer: () => void;
        onShowSettings: () => void;
    };
}

// Left panel with launch controls and quick settings access.
const Sidebar = ({
    launch,
    runtime,
    actions,
}: SidebarProps) => {
    const { getAccentStyles, getAccentHex, t } = useSettings();
    const { uiMode, setMode } = useUIMode();
    const { modpacks, selectedId, effectiveModpackId } = useModpack();
    const lastGame = useMemo(() => loadLastGame(effectiveModpackId), [effectiveModpackId]);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar_collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebar_collapsed', String(isCollapsed));
    }, [isCollapsed]);

    // В режиме modpacks проверяем, есть ли выбранный модпак
    // В режиме simple всегда разрешаем запуск (там используется дефолтный пак)
    const isModpackAvailable = uiMode === 'simple' || (selectedId && modpacks.some(m => m.id === selectedId));
    const canLaunch = isModpackAvailable && !runtime.isLaunching;

    // Memoize OptiFine support check
    // Sidebar now only manages nickname; version and modloader settings are configured per-modpack.

    return (
        <div className={cn(
            "flex flex-col bg-gradient-to-b from-zinc-200/95 to-zinc-300/50 dark:from-zinc-800 dark:to-zinc-900/80 backdrop-blur-sm border-r border-zinc-300/50 dark:border-zinc-700/50 shadow-2xl shadow-black/10 dark:shadow-black/30 z-10 relative transition-all duration-300 ease-out",
            isCollapsed ? "w-16 p-2" : "w-80 p-6"
        )}>
            {/* Collapse button at the very top - thin strip */}
            {!isCollapsed && (
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)} 
                    className="absolute top-0 left-0 right-0 h-6 text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 transition-colors flex items-center justify-center gap-1 border-b border-zinc-300/30 dark:border-zinc-700/30"
                >
                    <span className="text-xs">◀</span>
                    <span>{t('sidebar.collapse') || 'Collapse sidebar'}</span>
                </button>
            )}

            <div className={!isCollapsed ? "pt-6" : ""}>
                <SidebarHeader
                    appVersion={pkg.version}
                    onShowMultiplayer={actions.onShowMultiplayer}
                    onShowSettings={actions.onShowSettings}
                    getAccentStyles={(type) => getAccentStyles(type)}
                    getAccentHex={getAccentHex}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                    t={t}
                    uiMode={uiMode}
                    onChangeMode={setMode}
                />
            </div>

            {!isCollapsed && (
                <div className="space-y-6 flex-1 flex flex-col">
                    {/* Игровые настройки – ник, версия и (в Classic) модлоадер/OptiFine */}
                    <div className="space-y-4 sidebar-section-enter">
                        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                            {t('sidebar.game_settings') || 'Игровые настройки'}
                        </h2>
                        <NicknameSection
                            nickname={launch.nickname}
                            setNickname={launch.setNickname}
                            isOffline={launch.isOffline}
                            t={t}
                        />

                        {uiMode === 'simple' && (
                            <div className="space-y-3 sidebar-section-enter" style={{ animationDelay: '50ms' }}>
                                {/* Minecraft version selector */}
                                <div data-tour="version">
                                <Select
                                    label={t('modpacks.minecraft_version')}
                                    value={launch.version}
                                    onChange={(e) => launch.setVersion(e.target.value)}
                                >
                                    {launch.versions
                                        .filter((v) => v.type === 'release')
                                        .map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.id}
                                            </option>
                                        ))}
                                </Select>
                                </div>

                                {/* Modloader controls (Forge/Fabric/NeoForge) */}
                                <ModloaderSection
                                    version={launch.version}
                                    useForge={launch.useForge}
                                    setUseForge={launch.setUseForge}
                                    useFabric={launch.useFabric}
                                    setUseFabric={launch.setUseFabric}
                                    useNeoForge={launch.useNeoForge}
                                    setUseNeoForge={launch.setUseNeoForge}
                                    setLoader={launch.setLoader}
                                    forgeSupportedVersions={launch.supportedVersions.forge}
                                    fabricSupportedVersions={launch.supportedVersions.fabric}
                                    neoForgeSupportedVersions={launch.supportedVersions.neoForge}
                                    isModloadersLoading={launch.isModloadersLoading}
                                    t={t}
                                    getAccentStyles={(type) => getAccentStyles(type)}
                                />

                                {/* OptiFine toggle (only when supported and with Forge) */}
                                <OptifineToggle
                                    isOptiFineSupported={launch.supportedVersions.optiFine.includes(launch.version)}
                                    useForge={launch.useForge}
                                    useOptiFine={launch.useOptiFine}
                                    setUseOptiFine={launch.setUseOptiFine}
                                    t={t}
                                    getAccentStyles={(type) => getAccentStyles(type)}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Icons that move from header to center when collapsed - using staggered animation */}
            <div className={cn(
                "flex-1 flex flex-col items-center gap-2",
                isCollapsed 
                    ? "opacity-100 pointer-events-auto" 
                    : "opacity-0 h-0 overflow-hidden pointer-events-none"
            )}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={actions.onShowMultiplayer}
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-500 ease-out",
                        isCollapsed 
                            ? "scale-100 translate-y-0 opacity-100" 
                            : "scale-0 -translate-y-8 opacity-0"
                    )}
                    style={{
                        transitionDelay: isCollapsed ? '100ms' : '0ms',
                    }}
                    title={t('multiplayer.title') || 'Multiplayer'}
                >
                    <span className="text-xl">🌐</span>
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={actions.onShowSettings}
                    className={cn(
                        "w-12 h-12 p-0 transition-all duration-500 ease-out",
                        isCollapsed 
                            ? "scale-100 translate-y-0 opacity-100" 
                            : "scale-0 -translate-y-8 opacity-0"
                    )}
                    style={{
                        transitionDelay: isCollapsed ? '200ms' : '0ms',
                    }}
                    title={t('general.settings') || 'Settings'}
                >
                    <span className="text-xl">⚙️</span>
                </Button>
            </div>

            <div className="mt-auto">
                <LaunchControls
                    isLaunching={runtime.isLaunching}
                    progress={runtime.progress}
                    statusText={runtime.statusText}
                    onLaunch={runtime.onLaunch}
                    t={t}
                    getAccentHex={getAccentHex}
                    getAccentStyles={(type) => getAccentStyles(type)}
                    isCollapsed={isCollapsed}
                    canLaunch={Boolean(canLaunch)}
                    lastLaunch={lastGame ? formatLastLaunch(lastGame.timestamp, t) : undefined}
                />
            </div>
        </div>
    );
};

export default Sidebar;
