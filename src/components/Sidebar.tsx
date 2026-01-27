import React, { useState, useEffect, useMemo } from 'react';
import pkg from '../../package.json';
import { useSettings } from '../contexts/SettingsContext';
import type { MCVersion } from '../services/versions/types';
import type { VersionHint } from '../utils/minecraftVersions';
import { SidebarHeader } from './sidebar/SidebarHeader';
import { NicknameSection } from './sidebar/NicknameSection';
import { VersionSection } from './sidebar/VersionSection';
import { ModloaderSection } from './sidebar/ModloaderSection';
import { OptifineToggle } from './sidebar/OptifineToggle';
import { LaunchControls } from './sidebar/LaunchControls';
import { Button } from './ui/Button';
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
const Sidebar = React.memo(({
    launch,
    runtime,
    actions,
}: SidebarProps) => {
    const { getAccentStyles, getAccentHex, t } = useSettings();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebar_collapsed');
        return saved === 'true';
    });

    useEffect(() => {
        localStorage.setItem('sidebar_collapsed', String(isCollapsed));
    }, [isCollapsed]);

    // Memoize OptiFine support check
    const isOptiFineSupported = useMemo(
        () => launch.supportedVersions.optiFine.includes(launch.version),
        [launch.supportedVersions.optiFine, launch.version]
    );

    return (
        <div className={cn(
            "flex flex-col bg-gradient-to-b from-zinc-200/95 to-zinc-300/50 dark:from-zinc-800 dark:to-zinc-900/80 backdrop-blur-sm border-r border-zinc-300/50 dark:border-zinc-700/50 shadow-2xl shadow-black/10 dark:shadow-black/30 z-10 relative transition-all duration-300 ease-out",
            isCollapsed ? "w-16 p-2" : "w-80 p-6"
        )}>

            <SidebarHeader
                appVersion={pkg.version}
                onShowMultiplayer={actions.onShowMultiplayer}
                onShowSettings={actions.onShowSettings}
                getAccentStyles={(type) => getAccentStyles(type)}
                getAccentHex={getAccentHex}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
                t={t}
            />

            {!isCollapsed && (
                <div className="space-y-6 flex-1 flex flex-col pt-2">
                {/* Игровые настройки */}
                <div className="space-y-4">
                    <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('sidebar.game_settings') || 'Игровые настройки'}
                    </h2>
                    <NicknameSection nickname={launch.nickname} setNickname={launch.setNickname} isOffline={launch.isOffline} t={t} />

                    <VersionSection version={launch.version} setVersion={launch.setVersion} versions={launch.versions} currentHint={launch.currentHint} t={t} />
                </div>

                {/* Разделитель */}
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-300/50 dark:via-zinc-700/50 to-transparent" />

                {/* Модлоадеры и моды */}
                <div className="space-y-4">
                    <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                        {t('sidebar.mods') || 'Моды и модлоадеры'}
                    </h2>
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
                    t={t}
                    getAccentStyles={(type) => getAccentStyles(type)}
                />

                <OptifineToggle
                    isOptiFineSupported={isOptiFineSupported}
                    useForge={launch.useForge}
                    useOptiFine={launch.useOptiFine}
                    setUseOptiFine={launch.setUseOptiFine}
                    t={t}
                    getAccentStyles={(type) => getAccentStyles(type)}
                    />
                </div>
                </div>
            )}

            {isCollapsed && (
                <div className="flex-1 flex flex-col items-center gap-4 pt-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={actions.onShowMultiplayer}
                        className="w-12 h-12 p-0"
                        title={t('multiplayer.title') || 'Multiplayer'}
                    >
                        <span className="text-xl">🌐</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={actions.onShowSettings}
                        className="w-12 h-12 p-0"
                        title={t('general.settings') || 'Settings'}
                    >
                        <span className="text-xl">⚙️</span>
                    </Button>
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
                />
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Only re-render if important props changed
    return (
        prevProps.launch.nickname === nextProps.launch.nickname &&
        prevProps.launch.version === nextProps.launch.version &&
        prevProps.launch.useForge === nextProps.launch.useForge &&
        prevProps.launch.useFabric === nextProps.launch.useFabric &&
        prevProps.launch.useNeoForge === nextProps.launch.useNeoForge &&
        prevProps.launch.useOptiFine === nextProps.launch.useOptiFine &&
        prevProps.launch.isOffline === nextProps.launch.isOffline &&
        prevProps.runtime.isLaunching === nextProps.runtime.isLaunching &&
        prevProps.runtime.progress === nextProps.runtime.progress &&
        prevProps.runtime.statusText === nextProps.runtime.statusText &&
        JSON.stringify(prevProps.launch.supportedVersions) === JSON.stringify(nextProps.launch.supportedVersions)
    );
});

export default Sidebar;
