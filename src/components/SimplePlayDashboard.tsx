import { useCallback } from 'react';
import { Boxes } from 'lucide-react';
import { CLASSIC_MODPACK_ID } from '../../shared/constants';
import { useSettings, useUIMode } from '../contexts/SettingsContext';
import { getInstanceRamGb } from '../contexts/instances/utils/memory';
import { useEffectiveInstance } from '../features/instances/hooks/useEffectiveInstance';
import {
  dispatchInstanceConfigCommand,
  useInstanceConfigCommands,
} from '../features/instances/hooks/useInstanceConfigCommands';
import { useInstanceInvalidation } from '../features/instances/hooks/useInstanceInvalidation';
import { useModSupportedVersions } from '../features/launcher/hooks/useModSupportedVersions';
import type { LaunchStage } from '../features/launcher/services/launcherService';
import { usePersistentModpackNavigation } from '../features/modpacks/navigation/ModpackNavigationContext';
import { buildModpackRuntimeSummary } from '../features/modpacks/hooks/useModpackRuntimeSummary';
import { toDisplayErrorMessage } from '../utils/displayError';
import { cn } from '../utils/cn';
import { DegradedStateView } from './layout/DegradedStateView';
import { ClassicAdvancedSettings } from './simple-play/ClassicAdvancedSettings';
import { ClassicContentTabs } from './simple-play/ClassicContentTabs';
import { ClassicHero } from './simple-play/ClassicHero';
import { ClassicLaunchRail } from './simple-play/ClassicLaunchRail';
import {
  getRuntimeDependencyLoaderLabel,
} from './sidebar/modpackRuntimeDependencies';
import { Button } from './ui/Button';
import { LoadingSpinner } from './ui/LoadingSpinner';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export type SimplePlayDashboardProps = {
  launch: {
    version: string;
    nickname: string;
    loaderType: 'vanilla' | 'forge' | 'fabric' | 'neoforge';
    ram: number;
    isOffline: boolean;
  };
  runtime: {
    isLaunching: boolean;
    progress?: number;
    launchStage?: LaunchStage;
    statusText?: string;
    statusDetail?: string;
    onLaunch: () => void;
  };
  actions: {
    onShowMultiplayer: () => void;
    onShowSettings: () => void;
  };
};

export function SimplePlayDashboard({ launch, runtime, actions }: SimplePlayDashboardProps) {
  const { t, disableAnimations } = useSettings();
  const { setMode } = useUIMode();
  const modpackNavigation = usePersistentModpackNavigation();
  const effectiveInstance = useEffectiveInstance();
  const instanceId = effectiveInstance.status === 'ready' ? effectiveInstance.data.id : null;
  const configCommands = useInstanceConfigCommands(instanceId);
  const { invalidateInstance } = useInstanceInvalidation();
  const { optiFineVersions } = useModSupportedVersions();

  const showModpacks = useCallback(() => setMode('modpacks'), [setMode]);
  const retryClassic = useCallback(() => {
    void invalidateInstance(CLASSIC_MODPACK_ID);
  }, [invalidateInstance]);
  const openGuidedContent = useCallback((contentType: 'resourcepack' | 'shader') => {
    if (!instanceId) return;
    const nextView = {
      type: contentType === 'resourcepack' ? 'addResourcePack' : 'addShader',
      modpackId: instanceId,
    } as const;
    modpackNavigation.navigate(nextView);
    setMode('modpacks');
  }, [instanceId, modpackNavigation, setMode]);

  const frameClassName = cn(
    'launcher-content-width flex min-h-full flex-col items-center px-4 py-6 sm:px-5 lg:px-6',
    !disableAnimations && 'animate-fade-in-up',
  );

  if (effectiveInstance.status === 'idle' || effectiveInstance.status === 'loading') {
    return (
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <div className={frameClassName}>
          <DegradedStateView
            variant="unavailable"
            layout="workspace"
            testId="classic-dashboard-loading"
            title={translateWithFallback(t, 'dashboard.classic_loading_title', 'Loading Classic')}
            description={translateWithFallback(
              t,
              'dashboard.classic_loading_desc',
              'Reading the canonical Classic configuration.',
            )}
          >
            <LoadingSpinner size="md" variant="accent" />
          </DegradedStateView>
        </div>
      </div>
    );
  }

  if (effectiveInstance.status === 'error') {
    const fallback = translateWithFallback(
      t,
      'dashboard.classic_error_desc',
      'Classic is temporarily unavailable. Retry without leaving this screen.',
    );
    return (
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <div className={frameClassName}>
          <DegradedStateView
            variant="error"
            layout="workspace"
            testId="classic-dashboard-error"
            title={translateWithFallback(t, 'dashboard.classic_error_title', 'Classic could not be loaded')}
            description={toDisplayErrorMessage(effectiveInstance.error.message, fallback)}
            footer={(
              <>
                <Button variant="secondary" size="sm" onClick={retryClassic}>
                  {translateWithFallback(t, 'operations.retry', 'Retry')}
                </Button>
                <Button variant="ghost" size="sm" onClick={showModpacks}>
                  <Boxes className="h-4 w-4" />
                  {translateWithFallback(t, 'dashboard.go_to_modpacks', 'Go to Modpacks')}
                </Button>
              </>
            )}
          />
        </div>
      </div>
    );
  }

  if (effectiveInstance.status === 'uninitialized') {
    return (
      <div className="h-full w-full overflow-y-auto overflow-x-hidden">
        <div className={frameClassName}>
          <DegradedStateView
            variant="unavailable"
            layout="workspace"
            testId="classic-dashboard-unavailable"
            title={translateWithFallback(t, 'dashboard.classic_unavailable_title', 'Classic is not initialized')}
            description={translateWithFallback(
              t,
              'dashboard.classic_unavailable_desc',
              'Retry the Classic configuration or continue in Modpacks.',
            )}
            footer={(
              <>
                <Button variant="secondary" size="sm" onClick={retryClassic}>
                  {translateWithFallback(t, 'operations.retry', 'Retry')}
                </Button>
                <Button variant="ghost" size="sm" onClick={showModpacks}>
                  <Boxes className="h-4 w-4" />
                  {translateWithFallback(t, 'dashboard.go_to_modpacks', 'Go to Modpacks')}
                </Button>
              </>
            )}
          />
        </div>
      </div>
    );
  }

  const config = effectiveInstance.data.snapshot;
  const runtimeSummary = buildModpackRuntimeSummary({
    config,
    optiFineVersions: optiFineVersions.length > 0 ? optiFineVersions : undefined,
  });
  const classicRuntime = runtimeSummary.runtime;
  const loaderLabel = getRuntimeDependencyLoaderLabel(classicRuntime, t);
  const lockLaunchSurface = runtime.isLaunching;
  const classicDescription = translateWithFallback(
    t,
    'dashboard.classic_surface_desc',
    'Use the sidebar to choose your version, nickname, and launch settings before you play.',
  );

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <div className={frameClassName}>
        <ClassicHero
          name={config.name}
          subtitle={`${classicRuntime.minecraftVersion} • ${loaderLabel}`}
          description={classicDescription}
          busy={lockLaunchSurface}
          onShowSettings={actions.onShowSettings}
          onShowModpacks={showModpacks}
        />
        <ClassicLaunchRail
          isLaunching={runtime.isLaunching}
          progress={runtime.progress}
          launchStage={runtime.launchStage}
          statusText={runtime.statusText}
          statusDetail={runtime.statusDetail}
          minecraftVersion={classicRuntime.minecraftVersion}
          loaderLabel={loaderLabel}
          ramGb={getInstanceRamGb(config, 4)}
          isOffline={launch.isOffline}
        />
        <ClassicAdvancedSettings
          config={config}
          readOnly={lockLaunchSurface}
          onMemoryChange={(gb) => dispatchInstanceConfigCommand(configCommands.setMemoryGb(gb))}
          onMinMemoryChange={(gb) => dispatchInstanceConfigCommand(configCommands.setMinMemoryGb(gb))}
          onVmOptionsChange={(options) => dispatchInstanceConfigCommand(configCommands.setVmOptions(options))}
          onGameArgsChange={(args) => dispatchInstanceConfigCommand(configCommands.setGameExtraArgs(args))}
          onResolutionChange={(resolution) => dispatchInstanceConfigCommand(configCommands.setGameResolution(resolution))}
          onAutoConnectChange={(server) => dispatchInstanceConfigCommand(configCommands.setAutoConnectServer(server))}
        />
        <ClassicContentTabs
          instanceId={effectiveInstance.data.id}
          showMods={Boolean(classicRuntime.modLoader)}
          runtimeSummary={runtimeSummary}
          onOpenGuidedContent={openGuidedContent}
        />
        <Button type="button" variant="ghost" onClick={showModpacks} disabled={lockLaunchSurface} className="mt-8">
          <Boxes className="h-4 w-4" />
          {translateWithFallback(t, 'dashboard.go_to_modpacks', 'Go to Modpacks')}
        </Button>
      </div>
    </div>
  );
}
