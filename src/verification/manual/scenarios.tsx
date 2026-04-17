import React, { useEffect, useMemo, useState } from 'react';
import { SettingsProvider } from '../../contexts/SettingsContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { ConfirmProvider } from '../../contexts/ConfirmContext';
import { ModpackProvider } from '../../contexts/ModpackContext';
import { createTranslator } from '../../contexts/settings/i18n';
import type { UIMode } from '../../contexts/settings/types';
import { LAUNCHER_MARK_PATH } from '../../app/assets/branding';
import SettingsPage from '../../components/SettingsPage';
import { WelcomePage } from '../../components/onboarding/WelcomePage';
import { OnboardingTour, type TourStep } from '../../components/onboarding/OnboardingTour';
import { SimplePlayDashboard } from '../../components/SimplePlayDashboard';
import { ModpackList } from '../../components/modpacks/ModpackList';
import { ModpackBrowser } from '../../components/modpacks/ModpackBrowser';
import { ModpackDetails } from '../../components/modpacks/ModpackDetails';
import { CreateModpackModal } from '../../components/modpacks/CreateModpackModal';
import { ExportModpackPage } from '../../components/modpacks/ExportModpackPage';
import { AddModModal } from '../../components/modpacks/AddModModal';
import { SidebarHeader } from '../../components/sidebar/SidebarHeader';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../features/modpacks/hooks/useModpackNavigation';
import { AccountsPage } from '../../features/accounts/AccountsPage';
import { ShareModal } from '../../features/share/ShareModal';
import { ScreenshotsTab } from '../../features/screenshots/components/ScreenshotsTab';
import { MirrorsSettings } from '../../features/settings/mirrors/MirrorsSettings';
import { StatisticsTab } from '../../features/settings/statistics/StatisticsTab';
import { WorldDatapacksModal } from '../../components/modpacks/details/WorldDatapacksModal';
import { CORE_VIEWS, type ManualVerificationView } from './views';
import { getManualVerificationModEntries, getManualVerificationModpackMetadata } from './mockEnvironment';

interface ManualVerificationScenarioProps {
  onReady: (message: string) => void;
}

function SettingsProviders(props: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        <ConfirmProvider>{props.children}</ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

function ModpackProviders(props: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ModpackProvider>
        <ToastProvider>
          <ConfirmProvider>{props.children}</ConfirmProvider>
        </ToastProvider>
      </ModpackProvider>
    </SettingsProvider>
  );
}

function ManualDashboardProviders(props: { language: 'en' | 'ru'; children: React.ReactNode }) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('settings_language', props.language);
    localStorage.setItem('simple_play_welcome_dismissed', 'true');
  }

  return <ModpackProviders>{props.children}</ModpackProviders>;
}

function useReadyByText(onReady: (message: string) => void, needles: string[], message: string) {
  const readyKey = needles.join('|');

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 4_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      const text = document.body.textContent ?? '';
      const hasAllNeedles = needles.every((needle) => text.includes(needle));

      if (hasAllNeedles) {
        onReady(message);
        return;
      }

      if (Date.now() < deadline) {
        window.setTimeout(tick, 50);
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [message, needles, onReady, readyKey]);
}

function OverviewScenario() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {CORE_VIEWS.filter((view) => view.id !== 'overview').map((view) => (
        <a
          key={view.id}
          href={`?view=${view.id}`}
          className="surface-card rounded-3xl p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="kicker-label mb-3">Core route</div>
          <h2 className="text-xl font-semibold text-foreground">{view.label}</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">{view.description}</p>
        </a>
      ))}
    </div>
  );
}

function WelcomeScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(onReady, ['FriendLauncher', 'Launcher setup', 'Get Started'], 'Welcome overlay rendered.');

  return (
    <SettingsProviders>
      <WelcomePage onComplete={() => undefined} onSkip={() => undefined} onShowSettings={() => undefined} />
    </SettingsProviders>
  );
}

function TourScenario({ onReady }: ManualVerificationScenarioProps) {
  const steps: TourStep[] = [
    {
      id: 'classic',
      target: '[data-manual-tour="classic"]',
      title: 'Classic flow',
      content: 'Quick launch controls stay anchored in the launcher shell.',
      position: 'bottom',
    },
    {
      id: 'modpacks',
      target: '[data-manual-tour="modpacks"]',
      title: 'Modpacks',
      content: 'Browse, inspect, and manage modpacks from the main route.',
      position: 'bottom',
    },
    {
      id: 'settings',
      target: '[data-manual-tour="settings"]',
      title: 'Settings',
      content: 'Theme, mirrors, storage, and accounts stay under one shell.',
      position: 'bottom',
    },
  ];

  useReadyByText(onReady, ['Classic flow', 'Skip'], 'Onboarding spotlight rendered with stable manual targets.');

  return (
    <SettingsProviders>
      <div className="relative min-h-[32rem] rounded-3xl border border-border/70 bg-card/80 p-8">
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.id}
              data-manual-tour={step.id}
              className="surface-card rounded-2xl p-4"
            >
              <div className="kicker-label mb-2">Tour target</div>
              <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-secondary">{step.content}</p>
            </div>
          ))}
        </div>
        <OnboardingTour
          steps={steps}
          isOpen={true}
          onComplete={() => undefined}
          onSkip={() => undefined}
        />
      </div>
    </SettingsProviders>
  );
}

function DashboardScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Vanilla', 'Ожидание Minecraft', 'Запуск не удался'],
    'Classic dashboard rendered with fallback art, loader truth, localized launch feedback, and read-only busy-state settings.',
  );

  return (
    <ManualDashboardProviders language="ru">
      <div className="space-y-8">
        <section className="space-y-3">
          <div>
            <div className="kicker-label mb-2">Waiting + read-only</div>
            <h2 className="text-xl font-semibold text-foreground">Localized waiting state with visible advanced settings</h2>
          </div>
          <SimplePlayDashboard
            launch={{
              version: '1.20.1',
              nickname: 'Steve',
              loaderType: 'vanilla',
              ram: 6,
              isOffline: true,
            }}
            runtime={{
              isLaunching: true,
              progress: undefined,
              launchStage: 'waiting',
              statusText: 'Ожидание Minecraft',
              statusDetail: 'Процесс Minecraft уже запущен. Ждем окно игры и первые логи.',
              onLaunch: () => undefined,
            }}
            actions={{
              onShowMultiplayer: () => undefined,
              onShowSettings: () => undefined,
            }}
          />
        </section>

        <section className="space-y-3">
          <div>
            <div className="kicker-label mb-2">Download truth</div>
            <h2 className="text-xl font-semibold text-foreground">Progress stays numeric only while files are actually downloading</h2>
          </div>
          <SimplePlayDashboard
            launch={{
              version: '1.20.1',
              nickname: 'Steve',
              loaderType: 'fabric',
              ram: 6,
              isOffline: true,
            }}
            runtime={{
              isLaunching: true,
              progress: 68,
              launchStage: 'downloading',
              statusText: 'Загрузка',
              statusDetail: 'Подготавливаем файлы игры и необходимые зависимости.',
              onLaunch: () => undefined,
            }}
            actions={{
              onShowMultiplayer: () => undefined,
              onShowSettings: () => undefined,
            }}
          />
        </section>

        <section className="space-y-3">
          <div>
            <div className="kicker-label mb-2">Failure persistence</div>
            <h2 className="text-xl font-semibold text-foreground">Failure remains visible after controls unlock</h2>
          </div>
          <SimplePlayDashboard
            launch={{
              version: '1.20.1',
              nickname: 'Steve',
              loaderType: 'fabric',
              ram: 6,
              isOffline: true,
            }}
            runtime={{
              isLaunching: false,
              progress: undefined,
              launchStage: 'failed',
              statusText: 'Запуск не удался',
              statusDetail: 'Minecraft завершился с кодом 1',
              onLaunch: () => undefined,
            }}
            actions={{
              onShowMultiplayer: () => undefined,
              onShowSettings: () => undefined,
            }}
          />
        </section>
      </div>
    </ManualDashboardProviders>
  );
}

function SettingsAccountsScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Launcher Settings', 'Accounts', 'Skin Management'],
    'Settings modal rendered directly on the accounts tab.',
  );

  return (
    <SettingsProviders>
      <SettingsPage onClose={() => undefined} initialTab="accounts" />
    </SettingsProviders>
  );
}

function Phase17PolishScenario({ onReady }: ManualVerificationScenarioProps) {
  const [collapsedMode, setCollapsedMode] = useState<UIMode>('modpacks');
  const sidebarTranslator = useMemo(() => createTranslator('en'), []);

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 4_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      const text = document.body.textContent ?? '';
      const hasCollapsedActiveState = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).some(
        (button) => button.getAttribute('title') === 'Modpacks' && button.getAttribute('aria-pressed') === 'true',
      );
      const brandedFallbackImages = Array.from(document.querySelectorAll<HTMLImageElement>('img')).filter((image) => {
        const source = image.getAttribute('src');
        return typeof source === 'string' && (source === LAUNCHER_MARK_PATH || source.endsWith(LAUNCHER_MARK_PATH));
      });

      if (
        text.includes('Alpha Pack') &&
        text.includes('История') &&
        text.includes('Лес · Темная') &&
        text.includes('Положение сайдбара') &&
        hasCollapsedActiveState &&
        brandedFallbackImages.length >= 2
      ) {
        onReady(
          'Phase 17 proof rendered with constrained catalog cards, launcher-mark fallback art, coherent collapsed nav state, and Russian preset naming.',
        );
        return;
      }

      if (Date.now() < deadline) {
        window.setTimeout(tick, 50);
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [collapsedMode, onReady]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <div className="kicker-label mb-2">Compact navigation proof</div>
          <h2 className="text-xl font-semibold text-foreground">Collapsed sidebar mode keeps its active state readable</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[5.5rem,1fr]">
          <div className="surface-panel w-[5.5rem] rounded-[2rem] p-2">
            <SidebarHeader
              appVersion="0.4.0"
              onShowMultiplayer={() => undefined}
              onShowSettings={() => undefined}
              getAccentStyles={() => ({ className: '', style: undefined })}
              getAccentHex={() => '#10b981'}
              isCollapsed={true}
              onToggleCollapse={() => undefined}
              t={sidebarTranslator}
              uiMode={collapsedMode}
              onChangeMode={setCollapsedMode}
            />
          </div>
          <div className="surface-inline space-y-2 rounded-3xl p-5">
            <div className="kicker-label">Sidebar target</div>
            <p className="text-sm leading-6 text-secondary">
              The compact switcher stays icon-led, keeps explicit labels on hover, and preserves the active mode state
              instead of collapsing into ambiguous one-letter affordances.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <div>
            <div className="kicker-label mb-2">Installed catalog</div>
            <h2 className="text-xl font-semibold text-foreground">Sidebar-width cards remain readable without pack art</h2>
          </div>
          <ModpackProviders>
            <div className="surface-panel max-w-[30rem] rounded-3xl p-4">
              <ModpackList onNavigate={() => undefined} onCreateWizard={() => undefined} />
            </div>
          </ModpackProviders>
        </section>

        <section className="space-y-3">
          <div>
            <div className="kicker-label mb-2">Remote browser</div>
            <h2 className="text-xl font-semibold text-foreground">Search controls wrap cleanly while no-art cards fall back to launcher branding</h2>
          </div>
          <SettingsProviders>
            <div className="surface-panel max-w-[30rem] rounded-3xl p-4">
              <ModpackBrowser
                initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
                onBack={() => undefined}
                onNavigate={() => undefined}
                onStateChange={() => undefined}
              />
            </div>
          </SettingsProviders>
        </section>
      </div>

      <section className="space-y-3">
        <div>
          <div className="kicker-label mb-2">Russian settings shell</div>
          <h2 className="text-xl font-semibold text-foreground">Appearance copy stays localized and preset naming remains policy-aligned</h2>
        </div>
        <SettingsProviders>
          <SettingsPage onClose={() => undefined} initialTab="appearance" />
        </SettingsProviders>
      </section>
    </div>
  );
}

function AccountsScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Accounts', 'Skin Management', 'Open Skin Site'],
    'Standalone accounts page rendered with provider-aware skin actions.',
  );

  return (
    <SettingsProviders>
      <AccountsPage />
    </SettingsProviders>
  );
}

function ModpackListScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Modpacks', 'Alpha Pack', 'Modpack Browser'],
    'Installed modpack list rendered with the refreshed card language.',
  );

  return (
    <ModpackProviders>
      <div className="mx-auto max-w-6xl p-6">
        <ModpackList onNavigate={() => undefined} onCreateWizard={() => undefined} />
      </div>
    </ModpackProviders>
  );
}

function ModpackCreateScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Create New Modpack', 'Runtime dependencies', 'Minecraft Version'],
    'Create-modpack flow rendered with explicit runtime dependency summary.',
  );

  return (
    <ModpackProviders>
      <CreateModpackModal isOpen={true} onClose={() => undefined} />
    </ModpackProviders>
  );
}

function ModpackBrowserScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Modpack Browser', 'History', 'Alpha Pack'],
    'Modpack browser rendered with live results and preserved browser controls.',
  );

  return (
    <SettingsProviders>
      <div className="mx-auto max-w-6xl p-6">
        <ModpackBrowser
          initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
          onBack={() => undefined}
          onNavigate={() => undefined}
          onStateChange={() => undefined}
        />
      </div>
    </SettingsProviders>
  );
}

function ModpackDetailsScenario({ onReady }: ManualVerificationScenarioProps) {
  const fixtureMetadata = useMemo(() => getManualVerificationModpackMetadata('modpack-details'), []);
  const fixtureMods = useMemo(() => getManualVerificationModEntries(), []);

  useReadyByText(
    onReady,
    ['Gamma Runtime', 'Provided by pack runtime', 'Pack runtime mismatch', 'requires 0.17.0'],
    'Modpack details rendered with dense navigation plus runtime-provided and incompatible dependency truth.',
  );

  return (
    <ModpackProviders>
      <div className="min-h-screen p-6">
        <ModpackDetails
          modpackId="alpha"
          initialTab="mods"
          initialExpandedModId="gamma"
          initialMetadata={fixtureMetadata}
          initialMods={fixtureMods}
          hydrateFromIpc={false}
          onBack={() => undefined}
          onNavigate={() => undefined}
          onLaunch={() => undefined}
        />
      </div>
    </ModpackProviders>
  );
}

function ExportScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Export Modpack', 'Format', 'Modpacks'],
    'Export page rendered with shared page chrome and output controls.',
  );

  return (
    <SettingsProviders>
      <div className="min-h-screen p-6">
        <ExportModpackPage modpackId="alpha" onBack={() => undefined} />
      </div>
    </SettingsProviders>
  );
}

function AddModScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Add mods', 'Modrinth', 'Sodium'],
    'Add-mod modal rendered with live search results and batch action controls.',
  );

  return (
    <SettingsProviders>
      <div className="min-h-screen p-6">
        <AddModModal
          modpackId="alpha"
          isOpen={true}
          onClose={() => undefined}
          onAdded={() => undefined}
          defaultMCVersion="1.20.1"
          defaultLoader="fabric"
        />
      </div>
    </SettingsProviders>
  );
}

function ShareScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Share Modpack', 'Share code', 'Copy Code'],
    'Share modal rendered with generated share code and copy controls.',
  );

  return (
    <SettingsProviders>
      <ShareModal isOpen={true} onClose={() => undefined} modpackId="alpha" />
    </SettingsProviders>
  );
}

function ScreenshotsScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Screenshots', 'Open Folder', 'mountain-sunrise.png'],
    'Screenshots gallery rendered with live fixture images.',
  );

  return (
    <SettingsProviders>
      <div className="mx-auto max-w-6xl p-6">
        <ScreenshotsTab instancePath="/mock/.minecraft/instances/alpha" />
      </div>
    </SettingsProviders>
  );
}

function UtilitiesScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Download mirrors', 'Popular Modpacks', 'Alpha Pack'],
    'Utilities surface rendered with mirrors priority and local statistics.',
  );

  return (
    <SettingsProviders>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <MirrorsSettings />
        <StatisticsTab />
      </div>
    </SettingsProviders>
  );
}

function ContentScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Datapacks for Alpha World', 'Installed', 'Logic Tweaks'],
    'Content-management modal rendered with installed world datapacks.',
  );

  return (
    <SettingsProviders>
      <WorldDatapacksModal
        isOpen={true}
        onClose={() => undefined}
        instancePath="/mock/.minecraft/instances/alpha"
        worldFolder="AlphaWorld"
        worldName="Alpha World"
      />
    </SettingsProviders>
  );
}

export function ManualVerificationScenarios(props: { view: ManualVerificationView; onReady: (message: string) => void }) {
  const scenarioProps = { onReady: props.onReady };

  if (props.view === 'welcome') {
    return <WelcomeScenario {...scenarioProps} />;
  }

  if (props.view === 'tour') {
    return <TourScenario {...scenarioProps} />;
  }

  if (props.view === 'dashboard') {
    return <DashboardScenario {...scenarioProps} />;
  }

  if (props.view === 'settings-accounts') {
    return <SettingsAccountsScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-17-polish') {
    return <Phase17PolishScenario {...scenarioProps} />;
  }

  if (props.view === 'accounts') {
    return <AccountsScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-list') {
    return <ModpackListScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-create') {
    return <ModpackCreateScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-browser') {
    return <ModpackBrowserScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-details') {
    return <ModpackDetailsScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-export') {
    return <ExportScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-add') {
    return <AddModScenario {...scenarioProps} />;
  }

  if (props.view === 'share') {
    return <ShareScenario {...scenarioProps} />;
  }

  if (props.view === 'screenshots') {
    return <ScreenshotsScenario {...scenarioProps} />;
  }

  if (props.view === 'utilities') {
    return <UtilitiesScenario {...scenarioProps} />;
  }

  if (props.view === 'content') {
    return <ContentScenario {...scenarioProps} />;
  }

  return <OverviewScenario />;
}

export function ManualVerificationNavigation(props: { activeView: ManualVerificationView }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {CORE_VIEWS.map((view) => {
        const isActive = props.activeView === view.id;
        return (
          <a
            key={view.id}
            href={`?view=${view.id}`}
            className={[
              'rounded-full border px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'border-border-active bg-card text-foreground'
                : 'border-border/70 text-secondary hover:border-border-active hover:text-foreground',
            ].join(' ')}
          >
            {view.label}
          </a>
        );
      })}
    </nav>
  );
}
