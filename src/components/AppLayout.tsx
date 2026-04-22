import type { RefObject } from 'react';
import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import { UpdateNotification } from './UpdateNotification';

import { ModpackRouter } from './modpacks/ModpackRouter';
import type { UpdateInfo, UpdateStatus } from '../features/updater/hooks/useAppUpdater';
import { useUIMode } from '../contexts/SettingsContext';
import { SimplePlayDashboard } from './SimplePlayDashboard';
import type { MCVersion } from '../services/versions/types';
import type { VersionHint } from '../utils/minecraftVersions';

// SettingsPage is imported directly to avoid loading delay
import SettingsPage from './SettingsPage';
import MultiplayerPage from './MultiplayerPage';
import { cn } from '../utils/cn';
import { useSettings } from '../contexts/SettingsContext';
import type { LaunchStage } from '../features/launcher/services/launcherService';
import { windowControlsIPC } from '../services/ipc/windowControlsIPC';

export type AppLayoutProps = {
  theme: 'light' | 'dark';
  updates: {
    status: UpdateStatus;
    info: UpdateInfo | null;
    onInstall: () => void;
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
    progress?: number;
    launchStage: LaunchStage;
    statusText: string;
    statusDetail: string;
    canForceRestart: boolean;
    onLaunch: () => void;
    showConsole: boolean;
    logs: string[];
    logEndRef: RefObject<HTMLDivElement>;
    onCopyLogs: () => void;
    iconPath: string;
  };
};

import { BackgroundLayer } from './layout/BackgroundLayer';

export const APP_LAYOUT_SAFE_AREA_TEST_ID = 'app-layout-safe-area';
export const APP_LAYOUT_NOTIFICATIONS_TEST_ID = 'app-layout-notifications';

export function AppLayout(props: AppLayoutProps) {
  const { theme, updates, modpackOnLaunch, overlays, actions, launch, runtime } = props;
  const { uiMode } = useUIMode();
  const { sidebarPosition } = useSettings();
  const shellContract = windowControlsIPC.shellContract();

  // ... global hotkeys ...

  return (
    <div className={theme === 'dark' ? 'dark h-full w-full' : 'h-full w-full'}>
      <BackgroundLayer />
      <div className="relative h-full w-full overflow-hidden bg-background/28 text-foreground backdrop-blur-[2px]">
        <div className="flex h-full w-full bg-background/38 text-foreground backdrop-blur-[2px] sm:p-2">
          <div
            data-testid="app-shell-frame"
            className="relative flex h-full w-full min-w-0 flex-col overflow-hidden border border-border bg-background/26 shadow-2xl backdrop-blur-sm transition-colors duration-300 sm:rounded-[28px]"
          >
            <TitleBar />
            <div
              data-testid={APP_LAYOUT_NOTIFICATIONS_TEST_ID}
              data-shell-platform={shellContract}
              className="relative z-[90] flex shrink-0 flex-col"
            >
              <UpdateNotification status={updates.status} updateInfo={updates.info} onInstall={updates.onInstall} />
            </div>

            <div
              data-testid={APP_LAYOUT_SAFE_AREA_TEST_ID}
              data-shell-safe-area="shell-chrome"
              data-shell-platform={shellContract}
              className={cn(
                'relative flex min-h-0 flex-1 flex-col overflow-hidden',
                shellContract === 'native-macos' ? 'pt-1' : 'pt-2',
              )}
            >
              {overlays.showSettings && (
                <SettingsPage onClose={overlays.onCloseSettings} />
              )}
              {overlays.showMultiplayer && (
                <MultiplayerPage onBack={overlays.onBackFromMultiplayer} />
              )}

              <div
                data-testid="app-layout-split"
                className={cn(
                  'relative flex min-h-0 flex-1 overflow-hidden',
                  sidebarPosition === 'right' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <Sidebar
                  launch={launch}
                  runtime={runtime}
                  actions={actions}
                />

                <div
                  data-testid="app-layout-main"
                  className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/56 backdrop-blur-sm transition-all duration-300"
                >
                  <div key={uiMode} className="mode-switch-enter flex min-h-0 flex-1 flex-col">
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
        </div>
      </div>
    </div>
  );
}
