import type { RefObject } from 'react';
import React, { lazy, Suspense, useMemo } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import { UpdateNotification } from './UpdateNotification';
import { ModpackUpdateNotification } from './modpacks/ModpackUpdateNotification';
import { ConsoleView } from './layout/ConsoleView';
import { ModpackList } from './modpacks/ModpackList';
import { LoadingSpinner } from './ui/LoadingSpinner';
import type { UpdateInfo, UpdateStatus } from '../features/updater/hooks/useAppUpdater';
import type { ModpackUpdateInfo } from '../features/modpacks/hooks/useModpackUpdates';
import type { MCVersion } from '../services/versions/types';
import type { VersionHint } from '../utils/minecraftVersions';

// Lazy load heavy components
const SettingsPage = lazy(() => import('./SettingsPage').then(m => ({ default: m.default })));
const MultiplayerPage = lazy(() => import('./MultiplayerPage').then(m => ({ default: m.default })));

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
    supportedVersions: {
      forge: string[];
      fabric: string[];
      optiFine: string[];
      neoForge: string[];
    };
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

export const AppLayout = React.memo(function AppLayout(props: AppLayoutProps) {
  const { theme, updates, modpackUpdates, overlays, actions, launch, runtime } = props;

  // Memoize modpackUpdates check to prevent unnecessary re-renders
  const hasModpackUpdates = useMemo(() => modpackUpdates && modpackUpdates.updates.length > 0, [modpackUpdates]);

  return (
    <div className={theme === 'dark' ? 'dark h-full w-full' : 'h-full w-full'}>
      <div className="flex flex-col h-screen w-full bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans border border-zinc-200 dark:border-zinc-800 shadow-2xl">
        <UpdateNotification status={updates.status} updateInfo={updates.info} onInstall={updates.onInstall} />
        {hasModpackUpdates && modpackUpdates && <ModpackUpdateNotification updates={modpackUpdates.updates} onDismiss={modpackUpdates.onDismiss} />}
        <TitleBar />

        {overlays.showSettings && (
          <Suspense fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <SettingsPage onClose={overlays.onCloseSettings} />
          </Suspense>
        )}
        {overlays.showMultiplayer && (
          <Suspense fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
              <LoadingSpinner size="lg" />
            </div>
          }>
            <MultiplayerPage onBack={overlays.onBackFromMultiplayer} />
          </Suspense>
        )}

        <div className="flex flex-1 overflow-hidden relative">
          <Sidebar
            launch={launch}
            runtime={runtime}
            actions={actions}
          />

          <div className="flex-1 flex flex-col bg-gradient-to-br from-zinc-50/50 to-white dark:from-zinc-950 dark:to-zinc-900 min-w-0 transition-all duration-300">
            {runtime.showConsole ? (
              <ConsoleView logs={runtime.logs} logEndRef={runtime.logEndRef} onCopyLogs={runtime.onCopyLogs} />
            ) : (
              <ModpackList />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if important props changed
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.updates.status === nextProps.updates.status &&
    prevProps.updates.info === nextProps.updates.info &&
    prevProps.overlays.showSettings === nextProps.overlays.showSettings &&
    prevProps.overlays.showMultiplayer === nextProps.overlays.showMultiplayer &&
    prevProps.runtime.isLaunching === nextProps.runtime.isLaunching &&
    prevProps.runtime.progress === nextProps.runtime.progress &&
    prevProps.runtime.showConsole === nextProps.runtime.showConsole &&
    prevProps.launch.nickname === nextProps.launch.nickname &&
    prevProps.launch.version === nextProps.launch.version &&
    prevProps.modpackUpdates?.updates.length === nextProps.modpackUpdates?.updates.length
  );
});

