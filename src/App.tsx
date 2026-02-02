import { useCallback, useMemo, useRef } from 'react';
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
  const { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions, isLoading: isModloadersLoading } = useModSupportedVersions();

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
    loaderType,
  } = useLaunchState({ forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions });

  const handleLaunch = useLaunchHandler({
    launchGame,
    nickname,
    launchVersion,
    ram,
    hideLauncher,
    useOptiFine,
  });

  // Stable ref so ModpackRouter doesn't re-render when handleLaunch changes during downloads
  const onLaunchRef = useRef(handleLaunch);
  onLaunchRef.current = handleLaunch;
  const stableOnLaunch = useCallback(() => onLaunchRef.current(), []);

  const currentHint = useMemo(
    () => getVersionHint(modpackConfig?.runtime?.minecraft || '1.12.2', t, getAccentStyles('text')),
    [modpackConfig?.runtime?.minecraft, t, getAccentStyles]
  );

  // Tour steps — порядок: классика, модпаки, настройки, мультиплеер, никнейм, версия, модлоадеры, запуск
  const tourSteps: TourStep[] = useMemo(() => [
    {
      id: 'classic',
      target: '[data-tour="classic"]',
      title: t('onboarding.tour.step_classic.title') || 'Классика',
      content: t('onboarding.tour.step_classic.content') || 'Режим быстрого запуска без менеджмента модпаков. Укажите никнейм, версию и модлоадер, затем нажмите «Играть».',
      position: 'bottom',
    },
    {
      id: 'modpacks',
      target: '[data-tour="modpacks"]',
      title: t('onboarding.tour.step_modpacks.title') || 'Модпаки',
      content: t('onboarding.tour.step_modpacks.content') || 'Здесь вы можете выбрать или создать модпак. Модпаки содержат моды, настройки и версию Minecraft.',
      position: 'bottom',
    },
    {
      id: 'settings',
      target: '[data-tour="settings"]',
      title: t('onboarding.tour.step_settings.title') || 'Настройки',
      content: t('onboarding.tour.step_settings.content') || 'Путь к Minecraft, язык, тема, источник загрузок и другие параметры лаунчера.',
      position: 'bottom',
    },
    {
      id: 'multiplayer',
      target: '[data-tour="multiplayer"]',
      title: t('onboarding.tour.step_multiplayer.title') || 'Мультиплеер',
      content: t('onboarding.tour.step_multiplayer.content') || 'Управление серверами и подключением к мультиплееру.',
      position: 'bottom',
    },
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
      content: t('onboarding.tour.step_modloaders.content') || 'Выберите модлоадер (Forge, Fabric, NeoForge).',
      position: 'right',
    },
    {
      id: 'launch',
      target: '[data-tour="launch"]',
      title: t('onboarding.tour.step_launch.title') || 'Запуск игры',
      content: t('onboarding.tour.step_launch.content') || 'Нажмите эту кнопку, чтобы запустить Minecraft с выбранными настройками.',
      position: 'right',
    },
  ], [t]);

  return (
    <>
      {showWelcome && (
        <WelcomePage
          onComplete={handleWelcomeComplete}
          onSkip={handleSkip}
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
        modpackOnLaunch={stableOnLaunch}
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
          loaderType: loaderType === 'quilt' ? 'fabric' : loaderType,
          ram,
          supportedVersions: {
            forge: forgeVersions,
            fabric: fabricVersions,
            optiFine: optiFineVersions,
            neoForge: neoForgeVersions,
          },
          isModloadersLoading,
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
    <ErrorBoundaryWrapper>
      <AppRoot />
    </ErrorBoundaryWrapper>
  );
}
