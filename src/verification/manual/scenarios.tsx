import type { ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts';
import React, { useEffect, useMemo, useState } from 'react';
import { SettingsProvider, useSettings } from '../../contexts/SettingsContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { ConfirmProvider } from '../../contexts/ConfirmContext';
import { ModpackProvider } from '../../contexts/ModpackContext';
import { createTranslator } from '../../contexts/settings/i18n';
import type { UIMode } from '../../contexts/settings/types';
import { LAUNCHER_MARK_PATH, MEDIA_FALLBACK_PATH } from '../../app/assets/branding';
import TitleBar from '../../components/TitleBar';
import Sidebar, { type SidebarLaunchModel, type SidebarRuntimeModel } from '../../components/Sidebar';
import SettingsPage from '../../components/SettingsPage';
import { WelcomePage } from '../../components/onboarding/WelcomePage';
import { OnboardingTour, type TourStep } from '../../components/onboarding/OnboardingTour';
import { SimplePlayDashboard } from '../../components/SimplePlayDashboard';
import { ModpackList } from '../../components/modpacks/ModpackList';
import { ModpackBrowser } from '../../components/modpacks/ModpackBrowser';
import { ModpackDetails } from '../../components/modpacks/ModpackDetails';
import { ModpackCreationWizard } from '../../components/modpacks/ModpackCreationWizard';
import { AddModPage } from '../../components/modpacks/AddModPage';
import { ExportModpackPage } from '../../components/modpacks/ExportModpackPage';
import { InstallModpackPage } from '../../components/modpacks/InstallModpackPage';
import { ImportModpackPreviewPage } from '../../components/modpacks/ImportModpackPreviewPage';
import { AddModModal } from '../../components/modpacks/AddModModal';
import {
  setModpackPrimaryActionOwnership,
  type ModpackPrimaryActionOwnership,
} from '../../components/modpacks/primaryActionOwnership';
import { SidebarHeader } from '../../components/sidebar/SidebarHeader';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../features/modpacks/hooks/useModpackNavigation';
import { AccountsPage } from '../../features/accounts/AccountsPage';
import { ShareModal } from '../../features/share/ShareModal';
import { ScreenshotsTab } from '../../features/screenshots/components/ScreenshotsTab';
import { MirrorsSettings } from '../../features/settings/mirrors/MirrorsSettings';
import { StatisticsTab } from '../../features/settings/statistics/StatisticsTab';
import { ResourcePacksTab } from '../../components/modpacks/details/ResourcePacksTab';
import { WorldDatapacksModal } from '../../components/modpacks/details/WorldDatapacksModal';
import { cn } from '../../utils/cn';
import {
  CLOSEOUT_VIEWS,
  CORE_VIEWS,
  GENERAL_VIEWS,
  LEGACY_VIEWS,
  type ManualVerificationView,
  type ManualVerificationViewMeta,
} from './views';
import {
  getManualVerificationModEntries,
  getManualVerificationModpackMetadata,
  PHASE_21_RUNTIME_FIXTURE,
} from './mockEnvironment';

interface ManualVerificationScenarioProps {
  onReady: (message: string) => void;
}

function SettingsProviders(props: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider suppressToasts>
        <ConfirmProvider>{props.children}</ConfirmProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

function ModpackProviders(props: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <ModpackProvider>
        <ToastProvider suppressToasts>
          <ConfirmProvider>{props.children}</ConfirmProvider>
        </ToastProvider>
      </ModpackProvider>
    </SettingsProvider>
  );
}

function ManualShellProviders(props: { mode: UIMode; language?: 'en' | 'ru'; children: React.ReactNode }) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('settings_uiMode', props.mode);
    localStorage.setItem('settings_language', props.language ?? 'en');
    localStorage.setItem('simple_play_welcome_dismissed', 'true');
    localStorage.setItem('sidebar_collapsed', 'false');
  }

  return <ModpackProviders>{props.children}</ModpackProviders>;
}

const MANUAL_SHELL_ACTIONS = {
  onShowMultiplayer: () => undefined,
  onShowSettings: () => undefined,
};

const MANUAL_MC_VERSIONS = [
  {
    id: '1.20.1',
    type: 'release',
    url: 'https://example.invalid/versions/1.20.1.json',
    time: '2026-04-13T00:00:00.000Z',
    releaseTime: '2026-04-13T00:00:00.000Z',
  },
];

const MANUAL_SIDEBAR_LAUNCH: SidebarLaunchModel = {
  nickname: 'Steve',
  setNickname: () => undefined,
  version: '1.20.1',
  setVersion: () => undefined,
  versions: MANUAL_MC_VERSIONS,
  useForge: false,
  setUseForge: () => undefined,
  useFabric: false,
  setUseFabric: () => undefined,
  useOptiFine: false,
  setUseOptiFine: () => undefined,
  useNeoForge: false,
  setUseNeoForge: () => undefined,
  setLoader: () => undefined,
  isOffline: true,
  currentHint: null,
  supportedVersions: {
    forge: ['1.20.1'],
    fabric: ['1.20.1'],
    optiFine: ['1.20.1'],
    neoForge: ['1.20.1'],
  },
  isModloadersLoading: false,
};

const MANUAL_SHELL_RUNTIME: SidebarRuntimeModel = {
  isLaunching: false,
  progress: 0,
  launchStage: 'idle',
  statusText: '',
  statusDetail: '',
  canForceRestart: false,
  onLaunch: () => undefined,
};

const MANUAL_DASHBOARD_LAUNCH = {
  version: '1.20.1',
  nickname: 'Steve',
  loaderType: 'vanilla' as const,
  ram: 6,
  isOffline: true,
};

const MANUAL_BROWSER_RESULT: ModpackSearchResultItem = {
  platform: 'modrinth',
  projectId: 'alpha-pack',
  slug: 'alpha-pack',
  title: 'Alpha Pack',
  description: 'Route-owned install proof fixture for the Phase 19 shell-integrated harness.',
  iconUrl: '/icon.png',
  downloads: 1337,
  dateCreated: '2026-04-01T10:00:00.000Z',
  dateModified: '2026-04-13T08:30:00.000Z',
};

const MANUAL_BROWSER_VERSIONS: ModpackVersionDescriptor[] = [
  {
    platform: 'modrinth',
    versionId: 'alpha-pack-1.4.2',
    name: 'Alpha Pack 1.4.2',
    versionNumber: '1.4.2',
    mcVersions: ['1.20.1'],
    loaders: ['fabric'],
    changelog: 'Phase 19 shell-integrated proof fixture.',
    files: [
      {
        url: 'https://example.invalid/alpha-pack-1.4.2.mrpack',
        filename: 'alpha-pack-1.4.2.mrpack',
      },
    ],
  },
];

const MANUAL_IMPORT_FILE_PATH = '/mock/Desktop/alpha-pack-1.4.2.mrpack';

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

function matchesAssetSource(source: string | null, expected: string) {
  return typeof source === 'string' && (source === expected || source.endsWith(expected));
}

function useReadyByTextAndImageSource(
  onReady: (message: string) => void,
  needles: string[],
  expectedSrc: string,
  minimumImages: number,
  message: string,
) {
  const readyKey = `${needles.join('|')}::${expectedSrc}::${minimumImages}`;

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 4_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      const text = document.body.textContent ?? '';
      const hasAllNeedles = needles.every((needle) => text.includes(needle));
      const matchingImages = Array.from(document.querySelectorAll<HTMLImageElement>('img')).filter((image) =>
        matchesAssetSource(image.getAttribute('src') ?? image.currentSrc, expectedSrc),
      );

      if (hasAllNeedles && matchingImages.length >= minimumImages) {
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
  }, [expectedSrc, message, minimumImages, needles, onReady, readyKey]);
}

function findControlByLabel<T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(labelNeedle: string): T | null {
  const label = Array.from(document.querySelectorAll<HTMLLabelElement>('label')).find((candidate) =>
    candidate.textContent?.includes(labelNeedle),
  );

  if (!label?.htmlFor) {
    return null;
  }

  return document.getElementById(label.htmlFor) as T | null;
}

function setNativeControlValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
) {
  const descriptor =
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')
    ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    ?? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')
    ?? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');

  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

function findButtonByText(needle: string): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.trim().includes(needle),
    ) ?? null
  );
}

function usePhase21CreateSummaryReady(onReady: (message: string) => void) {
  useEffect(() => {
    let cancelled = false;
    let selectedFabric = false;
    const deadline = Date.now() + 6_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      const summaryCard = document.querySelector<HTMLElement>('[data-testid="modpack-dependency-summary"]');
      const summaryText = summaryCard?.textContent ?? '';

      if (
        summaryText.includes('Runtime dependencies')
        && summaryText.includes(PHASE_21_RUNTIME_FIXTURE.minecraftVersion)
        && summaryText.includes('Fabric')
      ) {
        onReady(
          'Phase 21 create-summary proof rendered inside the real shell with the shared runtime fixture seeded onto the wizard dependency summary.',
        );
        return;
      }

      const nameInput = findControlByLabel<HTMLInputElement>('Name');
      if (nameInput && nameInput.value !== PHASE_21_RUNTIME_FIXTURE.name) {
        setNativeControlValue(nameInput, PHASE_21_RUNTIME_FIXTURE.name);
      }

      const descriptionInput = findControlByLabel<HTMLTextAreaElement>('Description');
      if (descriptionInput && descriptionInput.value !== PHASE_21_RUNTIME_FIXTURE.description) {
        setNativeControlValue(descriptionInput, PHASE_21_RUNTIME_FIXTURE.description);
      }

      const nextButton = findButtonByText('Next');
      if (!summaryCard && nextButton && !nextButton.disabled) {
        nextButton.click();
      } else if (summaryCard && !selectedFabric) {
        const fabricButton = findButtonByText('Fabric');
        if (fabricButton) {
          fabricButton.click();
          selectedFabric = true;
        }
      }

      if (Date.now() < deadline) {
        window.setTimeout(tick, 75);
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [onReady]);
}

function useManualPrimaryActionOwnership(ownership: ModpackPrimaryActionOwnership) {
  useEffect(() => {
    setModpackPrimaryActionOwnership(ownership);

    return () => {
      setModpackPrimaryActionOwnership('shell');
    };
  }, [ownership]);
}

function Phase20ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 20 closeout proof</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase21ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 21 density proof</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase22ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 22 theme truth proof</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase24ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 24 closeout proof</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase19ShellChrome(props: {
  ownership: ModpackPrimaryActionOwnership;
  launch?: SidebarLaunchModel;
  runtime?: SidebarRuntimeModel;
  children: React.ReactNode;
}) {
  const { theme, sidebarPosition } = useSettings();

  useManualPrimaryActionOwnership(props.ownership);

  return (
    <div className={theme === 'dark' ? 'dark h-full w-full' : 'h-full w-full'}>
      <div className="relative h-full w-full overflow-hidden text-foreground">
        <div className="flex h-full w-full bg-background text-foreground sm:p-2">
          <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden border border-border shadow-2xl transition-colors duration-300 sm:rounded-[28px]">
            <TitleBar />

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
              <div
                className={cn(
                  'relative flex min-h-0 flex-1 overflow-hidden',
                  sidebarPosition === 'right' ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                <Sidebar
                  launch={props.launch ?? MANUAL_SIDEBAR_LAUNCH}
                  runtime={props.runtime ?? MANUAL_SHELL_RUNTIME}
                  actions={MANUAL_SHELL_ACTIONS}
                />

                <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background transition-all duration-300">
                  <div className="mode-switch-enter flex min-h-0 flex-1 flex-col">{props.children}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Phase19ShellFrame(props: {
  mode: UIMode;
  ownership: ModpackPrimaryActionOwnership;
  language?: 'en' | 'ru';
  launch?: SidebarLaunchModel;
  runtime?: SidebarRuntimeModel;
  children: React.ReactNode;
}) {
  return (
    <ManualShellProviders mode={props.mode} language={props.language}>
      <Phase19ShellChrome ownership={props.ownership} launch={props.launch} runtime={props.runtime}>
        {props.children}
      </Phase19ShellChrome>
    </ManualShellProviders>
  );
}

function ManualVerificationCardGrid(props: { views: ManualVerificationViewMeta[]; kicker: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {props.views.map((view) => (
        <a
          key={view.id}
          href={`?view=${view.id}`}
          className="surface-card rounded-3xl p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="kicker-label mb-3">{props.kicker}</div>
          <h2 className="text-xl font-semibold text-foreground">{view.label}</h2>
          <p className="mt-2 text-sm leading-6 text-secondary">{view.description}</p>
        </a>
      ))}
    </div>
  );
}

function OverviewScenario() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <div className="kicker-label mb-2">v0.5.0 closeout matrix</div>
          <h2 className="text-xl font-semibold text-foreground">Named release-proof views for final review and screenshot capture</h2>
          <p className="max-w-3xl text-sm leading-6 text-secondary">
            These are the milestone-owned review targets for Phase 24. They stay on deterministic fixtures so final screenshots, locale review, and release truth all point at the same evidence.
          </p>
        </div>
        <ManualVerificationCardGrid views={CLOSEOUT_VIEWS} kicker="Closeout route" />
      </section>

      <section className="space-y-3">
        <div>
          <div className="kicker-label mb-2">Shared manual routes</div>
          <h2 className="text-xl font-semibold text-foreground">Reusable shell and feature routes kept for direct inspection</h2>
        </div>
        <ManualVerificationCardGrid views={GENERAL_VIEWS} kicker="Shared route" />
      </section>

      <section className="space-y-3">
        <div>
          <div className="kicker-label mb-2">Historical phase proof</div>
          <h2 className="text-xl font-semibold text-foreground">Legacy evidence retained for regression context</h2>
        </div>
        <ManualVerificationCardGrid views={LEGACY_VIEWS} kicker="Legacy proof" />
      </section>
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
    ['FriendLauncher', 'Vanilla', 'Play'],
    'Phase 20 launcher-home proof rendered inside the real shell with one canonical mark, one shared wordmark, and one shell-owned primary Play action.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <SimplePlayDashboard
        launch={MANUAL_DASHBOARD_LAUNCH}
        runtime={MANUAL_SHELL_RUNTIME}
        actions={MANUAL_SHELL_ACTIONS}
      />
    </Phase19ShellFrame>
  );
}

function Phase24HomeCloseoutScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Vanilla', 'Play', 'v0.5.0 home closeout'],
    'Phase 24 home closeout rendered inside the real shell with deterministic launcher-home proof for final release review.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase24ProofCallout
          title="v0.5.0 home closeout"
          detail="This is the canonical launcher-home proof for milestone closeout: one shell-owned primary Play action, the final shared brand treatment, and deterministic motion-disabled fixture data for screenshot review."
        />
        <SimplePlayDashboard
          launch={MANUAL_DASHBOARD_LAUNCH}
          runtime={MANUAL_SHELL_RUNTIME}
          actions={MANUAL_SHELL_ACTIONS}
        />
      </div>
    </Phase19ShellFrame>
  );
}

function SettingsAppearanceScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Launcher Settings', 'Shared launcher brand'],
    'Phase 20 appearance proof rendered above the real shell so reviewers can verify the shared mark, wordmark, and accent boundary without leaving live composition.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <SettingsPage onClose={() => undefined} initialTab="appearance" />
    </Phase19ShellFrame>
  );
}

function Phase24ThemeDarkScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Launcher Settings', 'Shared launcher brand', 'Dark closeout pair'],
    'Phase 24 dark-theme closeout rendered inside the real shell with deterministic appearance state for release review.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase24ProofCallout
          title="Dark closeout pair"
          detail="Use this as the final dark baseline for the shipped appearance surface. The fixture is intentionally stable so comparison against the light closeout pair isolates theme differences instead of data churn."
        />
        <SettingsPage onClose={() => undefined} initialTab="appearance" />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase24ThemeLightScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Launcher Settings', 'Shared launcher brand', 'Light closeout pair'],
    'Phase 24 light-theme closeout rendered inside the real shell with deterministic appearance state for release review.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase24ProofCallout
          title="Light closeout pair"
          detail="This mirrors the dark closeout pair on the same shell-owned settings surface so reviewers can compare the shipped light variant without unrelated fixture drift."
        />
        <SettingsPage onClose={() => undefined} initialTab="appearance" />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase22ThemeDarkScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Launcher Settings', 'Shared launcher brand'],
    'Phase 22 dark-theme proof rendered inside the real shell with a shipped preset so shared appearance controls can be inspected under the final state contract.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase22ProofCallout
          title="Dark preset state stays readable in the live shell"
          detail="This proof keeps the appearance tab under the shipped forest preset so reviewers can inspect dark surfaces, accent propagation, and the brand boundary in the real launcher shell."
        />
        <SettingsPage onClose={() => undefined} initialTab="appearance" />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase22ThemeLightScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Launcher Settings', 'Shared launcher brand'],
    'Phase 22 light-theme proof rendered inside the real shell with a custom accent so shared appearance controls can be compared against the preset state.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase22ProofCallout
          title="Light custom-accent state stays coherent across the same controls"
          detail="Use this view against the dark preset proof to compare light surfaces, custom accent emphasis, and whether the same appearance controls still read as one system."
        />
        <SettingsPage onClose={() => undefined} initialTab="appearance" />
      </div>
    </Phase19ShellFrame>
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
              appVersion="0.5.0"
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
    ['FriendLauncher', 'Create New Modpack', 'Next'],
    'Phase 19 create-wizard proof rendered inside the real shell with title-bar clearance and one route-owned primary step action.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <ModpackCreationWizard onBack={() => undefined} />
    </Phase19ShellFrame>
  );
}

function ModpackBrowserScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByTextAndImageSource(
    onReady,
    ['Modpack Browser', 'History', 'Alpha Pack'],
    MEDIA_FALLBACK_PATH,
    1,
    'Phase 20 browser proof rendered inside the real shell with route-owned browsing controls and neutral fallback art for missing remote covers.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase20ProofCallout
          title="Content-heavy route stays on-brand inside the shell"
          detail="Use this route to verify that missing browser artwork falls back to the neutral media placeholder while the shell keeps one deliberate FMCL mark and wordmark system."
        />
        <ModpackBrowser
          initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
          onBack={() => undefined}
          onNavigate={() => undefined}
          onStateChange={() => undefined}
        />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase21BrowserDensityScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByTextAndImageSource(
    onReady,
    ['Modpack Browser', 'Atlas Control Room Longform Runtime Review Pack', 'Signal Overwatch Operations Board'],
    MEDIA_FALLBACK_PATH,
    1,
    'Phase 21 crowded browser proof rendered inside the real shell with dense cards, long labels, and visible fallback artwork.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full max-w-[1220px] min-w-0 flex-col gap-4">
          <Phase21ProofCallout
            title="Crowded browser density stays readable under real shell pressure"
            detail="Use this proof to inspect grouped filters, stacked metadata, and multi-card browse rhythm when long titles and crowded catalog data are no longer hidden by happy-path fixtures."
          />
          <ModpackBrowser
            initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: '' }}
            onBack={() => undefined}
            onNavigate={() => undefined}
            onStateChange={() => undefined}
          />
        </div>
      </div>
    </Phase19ShellFrame>
  );
}

function Phase24ModpacksCloseoutScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Modpack Browser', 'Alpha Pack', 'v0.5.0 modpacks closeout'],
    'Phase 24 modpacks closeout rendered inside the real shell with deterministic browse-state proof for final release review.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase24ProofCallout
          title="v0.5.0 modpacks closeout"
          detail="This route anchors the final modpacks proof on a real shell-integrated browse flow so dense metadata, route-owned actions, and neutral fallback art all remain reviewable under one deterministic fixture."
        />
        <ModpackBrowser
          initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
          onBack={() => undefined}
          onNavigate={() => undefined}
          onStateChange={() => undefined}
        />
      </div>
    </Phase19ShellFrame>
  );
}

function ModpackDetailsScenario({ onReady }: ManualVerificationScenarioProps) {
  const fixtureMetadata = useMemo(() => getManualVerificationModpackMetadata('modpack-details'), []);
  const fixtureMods = useMemo(() => getManualVerificationModEntries('modpack-details'), []);

  useReadyByText(
    onReady,
    ['FriendLauncher', 'Gamma Runtime', 'Update Available'],
    'Phase 19 modpack-details proof rendered inside the real shell with title-bar clearance, demoted shell launch, and one route-owned primary action.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
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
    </Phase19ShellFrame>
  );
}

function Phase21DetailsDensityScenario({ onReady }: ManualVerificationScenarioProps) {
  const fixtureMetadata = useMemo(() => getManualVerificationModpackMetadata('phase-21-details-density'), []);
  const fixtureMods = useMemo(() => getManualVerificationModEntries('phase-21-details-density'), []);

  useReadyByText(
    onReady,
    ['FriendLauncher', PHASE_21_RUNTIME_FIXTURE.name, 'Crowded Routing Diagnostics Companion'],
    'Phase 21 constrained-width details proof rendered with longer metadata and dense mod content inside the real shell.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route" language="ru">
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full max-w-[980px] min-w-0 flex-col gap-4">
          <Phase21ProofCallout
            title="Details hierarchy holds at constrained desktop width"
            detail="This state keeps the real shell, long metadata, Russian tab labels, and a dense mods tab on screen together so wrapping or CTA drift is immediately visible."
          />
          <ModpackDetails
            modpackId="alpha"
            initialTab="mods"
            initialExpandedModId="crowded-routing"
            initialMetadata={fixtureMetadata}
            initialMods={fixtureMods}
            onBack={() => undefined}
            onNavigate={() => undefined}
            onLaunch={() => undefined}
          />
        </div>
      </div>
    </Phase19ShellFrame>
  );
}

function Phase21RuntimeCreateScenario({ onReady }: ManualVerificationScenarioProps) {
  usePhase21CreateSummaryReady(onReady);

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase21ProofCallout
          title="Create flow is seeded to the same runtime truth as edit"
          detail="The manual harness advances the wizard to its runtime-summary step and seeds the shared Phase 21 runtime fixture so reviewers can compare create and edit truth directly."
        />
        <ModpackCreationWizard onBack={() => undefined} />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase21RuntimeEditScenario({ onReady }: ManualVerificationScenarioProps) {
  const fixtureMetadata = useMemo(() => getManualVerificationModpackMetadata('phase-21-runtime-edit'), []);
  const fixtureMods = useMemo(() => getManualVerificationModEntries('phase-21-runtime-edit'), []);

  useReadyByText(
    onReady,
    ['FriendLauncher', PHASE_21_RUNTIME_FIXTURE.name, 'Runtime dependencies'],
    'Phase 21 edit-summary proof rendered inside the real shell with the shared runtime fixture loaded into settings.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full max-w-[1040px] min-w-0 flex-col gap-4">
          <Phase21ProofCallout
            title="Edit settings stay truthful with the same runtime fixture"
            detail="Use this view to compare the settings summary against the create proof and confirm Minecraft version, loader, dependency count, and warnings stay aligned."
          />
          <ModpackDetails
            modpackId="alpha"
            initialTab="settings"
            initialMetadata={fixtureMetadata}
            initialMods={fixtureMods}
            onBack={() => undefined}
            onNavigate={() => undefined}
            onLaunch={() => undefined}
          />
        </div>
      </div>
    </Phase19ShellFrame>
  );
}

function ExportScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Export Modpack', 'Format'],
    'Phase 19 export-route proof rendered inside the real shell with title-bar clearance, demoted shell launch, and visible final action edges.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <ExportModpackPage modpackId="alpha" onBack={() => undefined} />
    </Phase19ShellFrame>
  );
}

function AddModScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Modrinth', 'Sodium'],
    'Phase 19 add-content proof rendered inside the real shell with title-bar clearance, demoted shell launch, and one route-owned add action.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <AddModPage modpackId="alpha" onBack={() => undefined} />
    </Phase19ShellFrame>
  );
}

function InstallScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Alpha Pack', 'Install modpack'],
    'Phase 19 install-route proof rendered inside the real shell with title-bar clearance, demoted shell launch, and one route-owned install action.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <InstallModpackPage
        modpack={MANUAL_BROWSER_RESULT}
        versions={MANUAL_BROWSER_VERSIONS}
        platform="modrinth"
        onBack={() => undefined}
      />
    </Phase19ShellFrame>
  );
}

function ImportPreviewScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Alpha Pack', 'Import'],
    'Phase 19 import-preview proof rendered inside the real shell with title-bar clearance, demoted shell launch, and visible final import controls.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <ImportModpackPreviewPage filePath={MANUAL_IMPORT_FILE_PATH} onBack={() => undefined} />
    </Phase19ShellFrame>
  );
}

function AddModModalScenario({ onReady }: ManualVerificationScenarioProps) {
  const fixtureMetadata = useMemo(() => getManualVerificationModpackMetadata('modpack-details'), []);
  const fixtureMods = useMemo(() => getManualVerificationModEntries('modpack-details'), []);

  useReadyByText(
    onReady,
    ['FriendLauncher', 'Gamma Runtime', 'Add mods', 'Sodium'],
    'Phase 19 add-mod modal proof rendered over the real shell with title-bar clearance, demoted shell launch, and visible final helper and action edges.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <>
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
        <AddModModal
          modpackId="alpha"
          isOpen={true}
          onClose={() => undefined}
          onAdded={() => undefined}
          defaultMCVersion="1.20.1"
          defaultLoader="fabric"
        />
      </>
    </Phase19ShellFrame>
  );
}

function ResourcePacksScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByTextAndImageSource(
    onReady,
    ['FriendLauncher', 'Installed Resource Packs', 'Painterly Depth'],
    MEDIA_FALLBACK_PATH,
    1,
    'Phase 20 deep-media proof rendered inside the real shell with no-art resource pack thumbnails using the shared neutral fallback policy.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase20ProofCallout
          title="Deep media routes honor the same fallback policy"
          detail="This representative route keeps media management in the real shell while proving that missing pack thumbnails fall back to the neutral artwork treatment instead of launcher-logo placeholders."
        />
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ResourcePacksTab
            instancePath="/mock/.minecraft/instances/alpha"
            onUpdate={() => undefined}
            onAddResourcePack={() => undefined}
          />
        </div>
      </div>
    </Phase19ShellFrame>
  );
}

function Phase21SecondaryDensityScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByTextAndImageSource(
    onReady,
    ['FriendLauncher', 'Installed Resource Packs', 'Painterly Depth Annotated UI Pack'],
    MEDIA_FALLBACK_PATH,
    1,
    'Phase 21 dense secondary-content proof rendered in the real shell with long labels, fallback art, and crowded resource-pack rows.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full max-w-[1120px] min-w-0 flex-col gap-4">
          <Phase21ProofCallout
            title="Secondary content stays legible when rows get busy"
            detail="This resource-pack route keeps long labels, mixed artwork states, and enough rows on screen to expose nested-scroll or unlabeled-value regressions."
          />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ResourcePacksTab
              instancePath="/mock/.minecraft/instances/alpha"
              onUpdate={() => undefined}
              onAddResourcePack={() => undefined}
            />
          </div>
        </div>
      </div>
    </Phase19ShellFrame>
  );
}

function Phase22LocaleEnScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Modpack Browser', 'Alpha Pack', 'Datapacks for Alpha World', 'Downloads', 'Updated'],
    'Phase 22 English locale proof rendered inside the real shell with route metadata and a secondary-content overlay using the shared formatting contract.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route" language="en">
      <>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <Phase22ProofCallout
            title="English route metadata stays truthful across primary and secondary surfaces"
            detail="The browser route remains the primary shell-owned screen while the datapacks modal overlays it, making counts and dates directly comparable under one locale contract."
          />
          <ModpackBrowser
            initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
            onBack={() => undefined}
            onNavigate={() => undefined}
            onStateChange={() => undefined}
          />
        </div>
        <WorldDatapacksModal
          isOpen={true}
          onClose={() => undefined}
          instancePath="/mock/.minecraft/instances/alpha"
          worldFolder="AlphaWorld"
          worldName="Alpha World"
        />
      </>
    </Phase19ShellFrame>
  );
}

function Phase24LocaleEnScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Modpack Browser', 'Alpha Pack', 'Datapacks for Alpha World', 'English closeout pair'],
    'Phase 24 English locale closeout rendered inside the real shell with deterministic route and secondary-content proof.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route" language="en">
      <>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <Phase24ProofCallout
            title="English closeout pair"
            detail="This is the final English review target for shell-integrated route metadata, counts, dates, and the overlaid datapacks surface. The paired Russian view stays on the same underlying fixture."
          />
          <ModpackBrowser
            initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
            onBack={() => undefined}
            onNavigate={() => undefined}
            onStateChange={() => undefined}
          />
        </div>
        <WorldDatapacksModal
          isOpen={true}
          onClose={() => undefined}
          instancePath="/mock/.minecraft/instances/alpha"
          worldFolder="AlphaWorld"
          worldName="Alpha World"
        />
      </>
    </Phase19ShellFrame>
  );
}

function Phase24LocaleRuScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Браузер модпаков', 'Alpha Pack', 'Датапаки для мира Alpha World', 'Russian closeout pair'],
    'Phase 24 Russian locale closeout rendered inside the real shell with deterministic route and secondary-content proof.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route" language="ru">
      <>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <Phase24ProofCallout
            title="Russian closeout pair"
            detail="This mirrors the English closeout pair on the same shell-owned route so reviewers can compare translated labels, counts, and dates without fixture drift."
          />
          <ModpackBrowser
            initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
            onBack={() => undefined}
            onNavigate={() => undefined}
            onStateChange={() => undefined}
          />
        </div>
        <WorldDatapacksModal
          isOpen={true}
          onClose={() => undefined}
          instancePath="/mock/.minecraft/instances/alpha"
          worldFolder="AlphaWorld"
          worldName="Alpha World"
        />
      </>
    </Phase19ShellFrame>
  );
}

function Phase22LocaleRuScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Браузер модпаков', 'Alpha Pack', 'Датапаки для мира Alpha World', 'Загрузок', 'Обновлено'],
    'Phase 22 Russian locale proof rendered inside the real shell with route metadata and a secondary-content overlay using the same shared formatting contract.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route" language="ru">
      <>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <Phase22ProofCallout
            title="Russian locale keeps the same route-state contract"
            detail="Use this alongside the English proof to compare the same browser counts, updated dates, and datapack summary labels after locale switches without leaving the live shell."
          />
          <ModpackBrowser
            initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', query: 'alpha' }}
            onBack={() => undefined}
            onNavigate={() => undefined}
            onStateChange={() => undefined}
          />
        </div>
        <WorldDatapacksModal
          isOpen={true}
          onClose={() => undefined}
          instancePath="/mock/.minecraft/instances/alpha"
          worldFolder="AlphaWorld"
          worldName="Alpha World"
        />
      </>
    </Phase19ShellFrame>
  );
}

function Phase24DegradedCloseoutScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Unable to search right now', 'Failed to load screenshots.', 'Needs attention'],
    'Phase 24 degraded closeout rendered inside the real shell with representative route and secondary-content failed-load proof.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase24ProofCallout
          title="Representative degraded-state closeout"
          detail="This closeout view pairs a route-level catalog failure with a secondary-content load failure inside the real shell. It is meant to prove the shipped degraded-state language on the same launcher chrome used by success-path closeout views."
        />
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.9fr)]">
          <div className="min-h-0 overflow-hidden rounded-3xl border border-border/70 bg-card/60">
            <AddModPage modpackId="alpha" onBack={() => undefined} />
          </div>
          <div className="min-h-0 overflow-hidden rounded-3xl border border-border/70 bg-card/60">
            <ScreenshotsTab instancePath="/mock/.minecraft/instances/alpha" />
          </div>
        </div>
      </div>
    </Phase19ShellFrame>
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

  if (props.view === 'phase-24-home-closeout') {
    return <Phase24HomeCloseoutScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-24-modpacks-closeout') {
    return <Phase24ModpacksCloseoutScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-24-degraded-closeout') {
    return <Phase24DegradedCloseoutScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-24-theme-dark') {
    return <Phase24ThemeDarkScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-24-theme-light') {
    return <Phase24ThemeLightScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-24-locale-en') {
    return <Phase24LocaleEnScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-24-locale-ru') {
    return <Phase24LocaleRuScenario {...scenarioProps} />;
  }

  if (props.view === 'tour') {
    return <TourScenario {...scenarioProps} />;
  }

  if (props.view === 'dashboard') {
    return <DashboardScenario {...scenarioProps} />;
  }

  if (props.view === 'settings-appearance') {
    return <SettingsAppearanceScenario {...scenarioProps} />;
  }

  if (props.view === 'settings-accounts') {
    return <SettingsAccountsScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-22-theme-dark') {
    return <Phase22ThemeDarkScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-22-theme-light') {
    return <Phase22ThemeLightScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-22-locale-en') {
    return <Phase22LocaleEnScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-22-locale-ru') {
    return <Phase22LocaleRuScenario {...scenarioProps} />;
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

  if (props.view === 'phase-21-browser-density') {
    return <Phase21BrowserDensityScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-21-details-density') {
    return <Phase21DetailsDensityScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-21-runtime-create') {
    return <Phase21RuntimeCreateScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-21-runtime-edit') {
    return <Phase21RuntimeEditScenario {...scenarioProps} />;
  }

  if (props.view === 'phase-21-secondary-density') {
    return <Phase21SecondaryDensityScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-export') {
    return <ExportScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-add') {
    return <AddModScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-install') {
    return <InstallScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-import-preview') {
    return <ImportPreviewScenario {...scenarioProps} />;
  }

  if (props.view === 'modpack-add-modal') {
    return <AddModModalScenario {...scenarioProps} />;
  }

  if (props.view === 'resource-packs') {
    return <ResourcePacksScenario {...scenarioProps} />;
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
  const sections: Array<{ title: string; views: ManualVerificationViewMeta[] }> = [
    { title: 'Closeout', views: CLOSEOUT_VIEWS },
    { title: 'Shared', views: GENERAL_VIEWS },
    { title: 'Legacy', views: LEGACY_VIEWS },
  ];

  return (
    <nav className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {CORE_VIEWS.filter((view) => view.group === 'hub').map((view) => {
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
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <div className="kicker-label">{section.title}</div>
          <div className="flex flex-wrap gap-2">
            {section.views.map((view) => {
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
          </div>
        </div>
      ))}
    </nav>
  );
}
