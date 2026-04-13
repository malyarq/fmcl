import { useMemo, useState, useEffect } from 'react';
import { Globe2, PanelLeftClose, Settings2 } from 'lucide-react';
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
import { Tooltip } from './ui/Tooltip';


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
    const { getAccentStyles, getAccentHex, t, compactMode, sidebarPosition } = useSettings();
    const { uiMode, setMode } = useUIMode();
    const { modpacks, selectedId, effectiveModpackId } = useModpack();
    const lastGame = useMemo(() => loadLastGame(effectiveModpackId), [effectiveModpackId]);
    const sidebarContentId = 'launcher-sidebar-content';
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
        <aside
            aria-label="FriendLauncher sidebar"
            className={cn(
            'relative z-10 flex flex-col border-r border-border bg-sidebar/86 shadow-[0_24px_80px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all duration-300 ease-out',
            isCollapsed ? "w-16 p-2" : (compactMode ? "w-64 p-4" : "w-80 p-6"),
            sidebarPosition === 'right' ? "border-l border-r-0 order-last" : "border-r border-l-0"
        )}
        >
            {/* Collapse button at the very top - thin strip */}
            {!isCollapsed && (
                <button
                    type="button"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    aria-controls={sidebarContentId}
                    aria-expanded={!isCollapsed}
                    className="absolute left-0 right-0 top-0 flex h-7 items-center justify-center gap-1 border-b border-border/50 text-[10px] text-secondary transition-colors hover:bg-background/60 hover:text-foreground"
                >
                    <PanelLeftClose className="h-3 w-3" />
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

            <div className="sr-only" aria-live="polite">
                {runtime.statusText || ''}
            </div>

            {!isCollapsed && (
                <div id={sidebarContentId} className="space-y-6 flex-1 flex flex-col">
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
                            disabled={runtime.isLaunching}
                        />

                        {uiMode === 'simple' && (
                            <div className="space-y-3 sidebar-section-enter" style={{ animationDelay: '50ms' }}>
                                {/* Minecraft version selector */}
                                <div data-tour="version">
                                    <Select
                                        label={t('modpacks.minecraft_version')}
                                        value={launch.version}
                                        onChange={(e) => launch.setVersion(e.target.value)}
                                        disabled={runtime.isLaunching}
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

                                {/* Modloader controls - always visible now */}
                                <div className="pt-2 space-y-4">
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
                                        disabled={runtime.isLaunching}
                                    />

                                    {/* OptiFine toggle (only when supported and with Forge) */}
                                    <OptifineToggle
                                        isOptiFineSupported={launch.supportedVersions.optiFine.includes(launch.version)}
                                        useForge={launch.useForge}
                                        useOptiFine={launch.useOptiFine}
                                        setUseOptiFine={launch.setUseOptiFine}
                                        t={t}
                                        getAccentStyles={(type) => getAccentStyles(type)}
                                        disabled={runtime.isLaunching}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Icons that move from header to center when collapsed - using staggered animation */}
            {isCollapsed && (
                <div className="flex-1 flex flex-col items-center gap-2 opacity-100 pointer-events-auto">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={actions.onShowMultiplayer}
                        disabled={runtime.isLaunching}
                        aria-label={t('multiplayer.title') || 'Multiplayer'}
                        className="w-12 h-12 p-0 transition-all duration-500 ease-out scale-100 translate-y-0 opacity-100"
                        style={{
                            transitionDelay: '100ms',
                        }}
                        title={t('multiplayer.title') || 'Multiplayer'}
                    >
                        <Globe2 className="h-5 w-5" />
                    </Button>
                    <Tooltip content={<span>{t('general.settings')} <span className="text-zinc-400 text-xs ml-1">Ctrl+,</span></span>} position="right">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={actions.onShowSettings}
                            disabled={runtime.isLaunching}
                            aria-label={t('general.settings') || 'Settings'}
                            className="w-12 h-12 p-0 transition-all duration-500 ease-out scale-100 translate-y-0 opacity-100"
                            style={{
                                transitionDelay: '200ms',
                            }}
                        >
                            <Settings2 className="h-5 w-5" />
                        </Button>
                    </Tooltip>
                </div>
            )}

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
        </aside>
    );
};

export default Sidebar;
