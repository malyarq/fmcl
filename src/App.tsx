import { useMemo } from 'react';
import { AppProviders } from './app/providers';
import { ErrorBoundaryWrapper } from './components/ErrorBoundaryWrapper';
import { useAppIcon } from './app/hooks/useAppIcon';
import { useAppOverlays } from './app/hooks/useAppOverlays';
import { useLaunchHandler } from './app/hooks/useLaunchHandler';
import { useOnboarding } from './app/hooks/useOnboarding';
import { getInstanceRamGb, useModpack } from './contexts/ModpackContext';
import { useSettings } from './contexts/SettingsContext';
import { useLaunchState } from './features/launch/hooks/useLaunchState';
import { useLauncher } from './features/launcher/hooks/useLauncher';
import { AppLayout } from './components/AppLayout';
import { useAppUpdater } from './features/updater/hooks/useAppUpdater';
import { useModSupportedVersions } from './features/launcher/hooks/useModSupportedVersions';
import { useVersions } from './features/launcher/hooks/useVersions';
import { getVersionHint } from './utils/minecraftVersions';
import { useModpackUpdates } from './features/modpacks/hooks/useModpackUpdates';
import { WelcomePage } from './components/onboarding/WelcomePage';
import { OnboardingTour, type TourStep } from './components/onboarding/OnboardingTour';

function AppRoot() {
  const { config: modpackConfig } = useModpack();
  const { showSettings, showMultiplayer, openSettings, closeSettings, openMultiplayer, closeMultiplayer } = useAppOverlays();
  const { iconPath } = useAppIcon();
  const {
    showWelcome,
    showTour,
    handleWelcomeComplete,
    handleTourComplete,
    handleSkip,
  } = useOnboarding();

  const { hideLauncher, showConsole, getAccentStyles, t, theme } = useSettings();
  const ram = getInstanceRamGb(modpackConfig, 4);

  const { isLaunching, progress, statusText, logs, logEndRef, handleLaunch: launchGame, copyLogs } = useLauncher();

  const { versions } = useVersions();
  const { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions } = useModSupportedVersions();

  // App updater with auto-check on mount
  const { status: updateStatus, updateInfo, installUpdate } = useAppUpdater(true);
  
  // Modpack updates checker
  const { updates: modpackUpdates } = useModpackUpdates(true);

  const {
    nickname,
    setNickname,
    version,
    setVersion,
    useForge,
    setUseForge,
    useFabric,
    setUseFabric,
    useNeoForge,
    setUseNeoForge,
    setLoader,
    useOptiFine,
    setUseOptiFine,
    isOffline,
    launchVersion,
  } = useLaunchState({ forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions });

  const handleLaunch = useLaunchHandler({
    launchGame,
    nickname,
    launchVersion,
    ram,
    hideLauncher,
    useOptiFine,
  });

  const currentHint = useMemo(() => getVersionHint(version, t, getAccentStyles('text')), [version, t, getAccentStyles]);

  // Tour steps
  const tourSteps: TourStep[] = useMemo(() => [
    {
      id: 'nickname',
      target: '[data-tour="nickname"]',
      title: t('onboarding.tour.step_nickname.title') || 'Никнейм',
      content: t('onboarding.tour.step_nickname.content') || 'Введите ваш игровой никнейм. Он будет использоваться при входе в игру.',
      position: 'right',
    },
    {
      id: 'version',
      target: '[data-tour="version"]',
      title: t('onboarding.tour.step_version.title') || 'Версия Minecraft',
      content: t('onboarding.tour.step_version.content') || 'Выберите версию Minecraft. Убедитесь, что она совместима с выбранным модпаком.',
      position: 'right',
    },
    {
      id: 'modloaders',
      target: '[data-tour="modloaders"]',
      title: t('onboarding.tour.step_modloaders.title') || 'Модлоадеры',
      content: t('onboarding.tour.step_modloaders.content') || 'Выберите модлоадер (Forge, Fabric, NeoForge) в зависимости от требований модпака.',
      position: 'right',
    },
    {
      id: 'launch',
      target: '[data-tour="launch"]',
      title: t('onboarding.tour.step_launch.title') || 'Запуск игры',
      content: t('onboarding.tour.step_launch.content') || 'Нажмите эту кнопку, чтобы запустить Minecraft с выбранными настройками.',
      position: 'top',
    },
  ], [t]);

  return (
    <>
      {showWelcome && (
        <WelcomePage
          onComplete={handleWelcomeComplete}
          onShowSettings={openSettings}
        />
      )}
      {showTour && (
        <OnboardingTour
          steps={tourSteps}
          isOpen={showTour}
          onComplete={handleTourComplete}
          onSkip={handleSkip}
        />
      )}
      <AppLayout
      theme={theme}
      updates={{
        status: updateStatus,
        info: updateInfo,
        onInstall: installUpdate,
      }}
      modpackUpdates={{
        updates: modpackUpdates,
      }}
      overlays={{
        showSettings,
        onCloseSettings: closeSettings,
        showMultiplayer,
        onBackFromMultiplayer: closeMultiplayer,
      }}
      actions={{
        onShowMultiplayer: openMultiplayer,
        onShowSettings: openSettings,
      }}
      launch={{
        nickname,
        setNickname,
        version,
        setVersion,
        versions,
        useForge,
        setUseForge,
        useFabric,
        setUseFabric,
        useNeoForge,
        setUseNeoForge,
        setLoader,
        useOptiFine,
        setUseOptiFine,
        isOffline,
        currentHint,
        supportedVersions: {
          forge: forgeVersions,
          fabric: fabricVersions,
          optiFine: optiFineVersions,
          neoForge: neoForgeVersions,
        },
      }}
      runtime={{
        isLaunching,
        progress,
        statusText,
        onLaunch: handleLaunch,
        showConsole,
        logs,
        logEndRef,
        onCopyLogs: copyLogs,
        iconPath,
      }}
      />
    </>
  );
}

export default function App() {
  return (
    <AppProviders>
      <ErrorBoundaryWrapper>
        <AppRoot />
      </ErrorBoundaryWrapper>
    </AppProviders>
  );
}
