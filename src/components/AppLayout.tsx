import type { RefObject } from 'react';
import { useMemo } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import { UpdateNotification } from './UpdateNotification';
import { ModpackUpdateNotification } from './modpacks/ModpackUpdateNotification';

import { ModpackRouter } from './modpacks/ModpackRouter';
import type { UpdateInfo, UpdateStatus } from '../features/updater/hooks/useAppUpdater';
import type { ModpackUpdateInfo } from '../features/modpacks/hooks/useModpackUpdates';
import { useUIMode } from '../contexts/SettingsContext';
import { SimplePlayDashboard } from './SimplePlayDashboard';
import type { MCVersion } from '../services/versions/types';
import type { VersionHint } from '../utils/minecraftVersions';

// SettingsPage is imported directly to avoid loading delay
import SettingsPage from './SettingsPage';
import MultiplayerPage from './MultiplayerPage';
import { cn } from '../utils/cn';
import { useSettings } from '../contexts/SettingsContext';

export type AppLayoutProps = {
  theme: 'light' | 'dark';
  updates: {
    status: UpdateStatus;
    info: UpdateInfo | null;
    onInstall: () => void;
  };
  modpackUpdates?: {
    updates: ModpackUpdateInfo[];
    onDismiss?: () => void;
  };
  modpackOnLaunch?: () => void | Promise<void>;
  overlays: {
    showSettings: boolean;
    onCloseSettings: () => void;
    showMultiplayer: boolean;
    onBackFromMultiplayer: () => void;
  };
  actions: {
    onShowMultiplayer: () => void;
    onShowSettings: () => void;
  };
  launch: {
    nickname: string;
    setNickname: (v: string) => void;
    version: string;
    setVersion: (v: string) => void;
    versions: MCVersion[];
    useForge: boolean;
    setUseForge: (v: boolean) => void;
    useFabric: boolean;
    setUseFabric: (v: boolean) => void;
    useNeoForge: boolean;
    setUseNeoForge: (v: boolean) => void;
    setLoader: (loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge') => void;
    useOptiFine: boolean;
    setUseOptiFine: (v: boolean) => void;
    isOffline: boolean;
    currentHint: VersionHint | null;
    loaderType: 'vanilla' | 'forge' | 'fabric' | 'neoforge';
    ram: number;
    supportedVersions: {
      forge: string[];
      fabric: string[];
      optiFine: string[];
      neoForge: string[];
    };
    isModloadersLoading?: boolean;
  };
  runtime: {
    isLaunching: boolean;
    progress: number;
    statusText: string;
    onLaunch: () => void;
    showConsole: boolean;
    logs: string[];
    logEndRef: RefObject<HTMLDivElement>;
    onCopyLogs: () => void;
    iconPath: string;
  };
};

import { BackgroundLayer } from './layout/BackgroundLayer';

export function AppLayout(props: AppLayoutProps) {
  const { theme, updates, modpackUpdates, modpackOnLaunch, overlays, actions, launch, runtime } = props;

  // Memoize modpackUpdates check to prevent unnecessary re-renders
  const hasModpackUpdates = useMemo(() => modpackUpdates && modpackUpdates.updates.length > 0, [modpackUpdates]);
  const { uiMode } = useUIMode();
  const { sidebarPosition } = useSettings();

  // ... global hotkeys ...

  return (
    <div className={theme === 'dark' ? 'dark h-full w-full' : 'h-full w-full'}>
      <BackgroundLayer />
      <div className="relative flex flex-col h-screen w-full bg-background text-foreground overflow-hidden font-sans border border-border shadow-2xl transition-colors duration-300">
        {/* ... UpdateNotification and TitleBar ... */}
        <UpdateNotification status={updates.status} updateInfo={updates.info} onInstall={updates.onInstall} />
        {hasModpackUpdates && modpackUpdates && <ModpackUpdateNotification updates={modpackUpdates.updates} onDismiss={modpackUpdates.onDismiss} />}
        <TitleBar />

        {overlays.showSettings && (
          <SettingsPage onClose={overlays.onCloseSettings} />
        )}
        {overlays.showMultiplayer && (
          <MultiplayerPage onBack={overlays.onBackFromMultiplayer} />
        )}

        <div className={cn(
          "flex flex-1 overflow-hidden relative",
          sidebarPosition === 'right' ? "flex-row-reverse" : "flex-row"
        )}>
          <Sidebar
            launch={launch}
            runtime={runtime}
            actions={actions}
          />

          <div className="flex-1 flex flex-col bg-background min-w-0 transition-all duration-300 overflow-hidden">
            <div key={uiMode} className="flex-1 flex flex-col mode-switch-enter min-h-0">
              {uiMode === 'modpacks' ? (
                <ModpackRouter onLaunch={modpackOnLaunch ?? runtime.onLaunch} />
              ) : (
                <SimplePlayDashboard launch={launch} runtime={runtime} actions={actions} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

