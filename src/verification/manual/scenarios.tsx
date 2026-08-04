import type { ProviderCatalogSearchResultItem, ProviderCatalogVersionDescriptor } from '@shared/contracts';
import React, { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { SettingsProvider, useSettings } from '../../contexts/SettingsContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { ConfirmProvider } from '../../contexts/ConfirmContext';
import { InstanceQueryProvider } from '../../features/instances/InstanceQueryProvider';
import { ModpackNavigationProvider } from '../../features/modpacks/navigation/ModpackNavigationProvider';
import { OperationRecoveryProvider } from '../../features/operations/recovery/OperationRecoveryProvider';
import { createTranslator } from '../../contexts/settings/i18n';
import type { UIMode } from '../../contexts/settings/types';
import { APP_ICON_PATH, LAUNCHER_MARK_PATH, MEDIA_FALLBACK_PATH } from '../../app/assets/branding';
import TitleBar from '../../components/TitleBar';
import Sidebar, { type SidebarLaunchModel, type SidebarRuntimeModel } from '../../components/Sidebar';
import SettingsPage from '../../components/SettingsPage';
import { WelcomePage } from '../../components/onboarding/WelcomePage';
import { OnboardingTour, type TourStep } from '../../components/onboarding/OnboardingTour';
import { SimplePlayDashboard } from '../../components/SimplePlayDashboard';
import { ModpackList } from '../../components/modpacks/ModpackList';
import { ModpackRouter } from '../../components/modpacks/ModpackRouter';
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
import { AppearanceTab } from '../../components/settings/tabs/AppearanceTab';
import { ResourcePacksTab } from '../../components/modpacks/details/ResourcePacksTab';
import { WorldDatapacksModal } from '../../components/modpacks/details/WorldDatapacksModal';
import MultiplayerPage from '../../components/MultiplayerPage';
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
      <ModpackNavigationProvider>
        <ToastProvider suppressToasts>
          <ConfirmProvider>{props.children}</ConfirmProvider>
        </ToastProvider>
      </ModpackNavigationProvider>
    </SettingsProvider>
  );
}

function ModpackProviders(props: { children: React.ReactNode }) {
  return (
    <SettingsProvider>
      <InstanceQueryProvider>
        <ModpackNavigationProvider>
          <ToastProvider suppressToasts>
            <ConfirmProvider>
              <OperationRecoveryProvider>{props.children}</OperationRecoveryProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ModpackNavigationProvider>
      </InstanceQueryProvider>
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
  useFabric: true,
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
  loaderType: 'fabric' as const,
  ram: 6,
  isOffline: true,
};

const MANUAL_BROWSER_RESULT: ProviderCatalogSearchResultItem = {
  platform: 'modrinth',
  projectId: 'alpha-pack',
  slug: 'alpha-pack',
  title: 'Alpha Pack',
  description: 'Route-owned install proof fixture for the Phase 19 shell-integrated harness.',
  iconUrl: APP_ICON_PATH,
  downloads: 1337,
  dateCreated: '2026-04-01T10:00:00.000Z',
  dateModified: '2026-04-13T08:30:00.000Z',
};

const MANUAL_BROWSER_VERSIONS: ProviderCatalogVersionDescriptor[] = [
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

const MANUAL_ARCHIVE_REFERENCE = 'manual-archive-reference';
const MANUAL_ARCHIVE_INSPECTION = {
  format: 'modrinth' as const,
  manifest: {
    formatVersion: 1,
    name: 'Alpha Pack',
    version: '1.4.2',
    minecraft: { version: '1.20.1', modLoaders: [] },
    files: [],
  },
};

function useReadyByText(onReady: (message: string) => void, needles: string[], message: string) {
  const readyKey = needles.join('|');
  const containsEveryNeedle = useEffectEvent((text: string) => (
    needles.every((needle) => text.includes(needle))
  ));

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 4_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      const text = document.body.textContent ?? '';
      const hasAllNeedles = containsEveryNeedle(text);

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
  }, [message, onReady, readyKey]);
}

function useReadyByChecks(
  onReady: (message: string) => void,
  checks: Array<{ id: string; when: () => boolean }>,
  message: string,
) {
  const readyKey = checks.map((check) => check.id).join('|');
  const everyCheckPasses = useEffectEvent(() => checks.every((check) => check.when()));

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 4_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      if (everyCheckPasses()) {
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
  }, [message, onReady, readyKey]);
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
  const containsEveryImageProofNeedle = useEffectEvent((text: string) => (
    needles.every((needle) => text.includes(needle))
  ));

  useEffect(() => {
    let cancelled = false;
    const deadline = Date.now() + 4_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      const text = document.body.textContent ?? '';
      const hasAllNeedles = containsEveryImageProofNeedle(text);
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
  }, [expectedSrc, message, minimumImages, onReady, readyKey]);
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

function findCheckboxByResultTitle(title: string): HTMLInputElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLDivElement>('div')).find((element) =>
      element.textContent?.includes(title) && Boolean(element.querySelector('input[type="checkbox"]')),
    )?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null
  );
}

function useGuidedSelectionAndSubmitReady(params: {
  onReady: (message: string) => void;
  selectionNeedle: string;
  actionNeedle: string;
  expectedNeedles: string[];
  message: string;
}) {
  const { actionNeedle, expectedNeedles, message, onReady, selectionNeedle } = params;
  const needlesText = expectedNeedles.join('\n');
  const readyKey = `${selectionNeedle}:${actionNeedle}:${needlesText}`;

  useEffect(() => {
    let cancelled = false;
    let selectionTriggered = false;
    let actionTriggered = false;
    const deadline = Date.now() + 6_000;

    const tick = () => {
      if (cancelled) {
        return;
      }

      const text = document.body.textContent ?? '';
      const hasAllNeedles = needlesText.split('\n').every((needle) => text.includes(needle));
      if (hasAllNeedles) {
        onReady(message);
        return;
      }

      const checkbox = findCheckboxByResultTitle(selectionNeedle);
      if (!selectionTriggered && checkbox && !checkbox.disabled && !checkbox.checked) {
        checkbox.click();
        selectionTriggered = true;
      }

      const actionButton = findButtonByText(actionNeedle);
      if (selectionTriggered && !actionTriggered && actionButton && !actionButton.disabled) {
        actionButton.click();
        actionTriggered = true;
      }

      if (Date.now() < deadline) {
        window.setTimeout(tick, 75);
      }
    };

    tick();

    return () => {
      cancelled = true;
    };
  }, [actionNeedle, message, needlesText, onReady, readyKey, selectionNeedle]);
}

function useGuidedActionNoticeReady(params: {
  onReady: (message: string) => void;
  actionNeedle: string;
  message: string;
}) {
  const { actionNeedle, message, onReady } = params;
  const readyKey = `${actionNeedle}:${message}`;

  useEffect(() => {
    let actionTriggered = false;
    let completed = false;

    const inspect = () => {
      if (completed) return;

      const notice = document.querySelector<HTMLElement>('[data-testid="add-mod-page-notice"]');
      if (notice) {
        completed = true;
        observer.disconnect();
        window.clearInterval(interval);
        window.clearTimeout(deadline);
        onReady(message);
        return;
      }

      const actionButton = document.querySelector<HTMLButtonElement>('[data-testid="guided-local-fallback-action"]')
        ?? findButtonByText(actionNeedle);
      if (!actionTriggered && actionButton && !actionButton.disabled) {
        actionTriggered = true;
        window.setTimeout(() => {
          if (completed) return;
          if (actionButton.isConnected && !actionButton.disabled) {
            actionButton.click();
            return;
          }
          actionTriggered = false;
          inspect();
        }, 0);
      }
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const interval = window.setInterval(inspect, 75);
    const deadline = window.setTimeout(() => {
      completed = true;
      observer.disconnect();
      window.clearInterval(interval);
    }, 6_000);
    inspect();

    return () => {
      completed = true;
      observer.disconnect();
      window.clearInterval(interval);
      window.clearTimeout(deadline);
    };
  }, [actionNeedle, message, onReady, readyKey]);
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

function Phase35ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 35 async and guided trust proof</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase41ProofCallout(props: { titleKey: string; detailKey: string }) {
  const { t } = useSettings();

  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5" data-testid="phase41-proof-callout">
      <div className="kicker-label mb-2">{t('phase41.proof_label')}</div>
      <h2 className="text-lg font-semibold text-foreground">{t(props.titleKey)}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{t(props.detailKey)}</p>
    </div>
  );
}

function Phase33ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 33 proof contract</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase34ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 34 details cohesion proof</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase36ProofCallout(props: { title: string; detail: string }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5">
      <div className="kicker-label mb-2">Phase 36 settings proof</div>
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{props.detail}</p>
    </div>
  );
}

function Phase36ProofChecklist(props: { items: string[] }) {
  return (
    <div className="surface-inline rounded-3xl p-4 sm:p-5" data-testid="phase36-proof-checklist">
      <div className="kicker-label mb-2">Observable review items</div>
      <ul className="space-y-2 text-sm leading-6 text-secondary">
        {props.items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-[rgb(var(--accent-main))]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
          <div className="kicker-label mb-2">Phase 33 proof routes</div>
          <h2 className="text-xl font-semibold text-foreground">Current milestone review now centers on classic truth and compact catalogs</h2>
          <p className="max-w-3xl text-sm leading-6 text-secondary">
            Start current signoff on Dashboard, Modpack List, and Modpack Browser. Those routes are the Phase 33 proof
            surfaces for truthful classic runtime labels, compact catalog headers, minimal card metadata, and coherent
            primary action geometry.
          </p>
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
    ['FriendLauncher', 'Fabric', 'Play'],
    'Phase 33 classic-truth proof rendered inside the real shell with Fabric wording and runtime labels that match the canonical launch target.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase33ProofCallout
          title="Classic runtime labels must stay truthful after cold start"
          detail="Use this route to verify the Fabric label and visible Minecraft version reflect the canonical launch target instead of drifting back to stale fallback state."
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

function Phase24HomeCloseoutScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Fabric', 'Play', 'v0.5.0 home closeout'],
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
  useReadyByChecks(
    onReady,
    [
      {
        id: 'settings-shell-header',
        when: () => Boolean(document.querySelector('[data-testid="settings-shell-header"] [role="tablist"]')),
      },
      {
        id: 'appearance-panel',
        when: () => Boolean(document.querySelector('#settings-panel-appearance[role="tabpanel"]')),
      },
      {
        id: 'preset-select',
        when: () => Boolean(document.querySelector('select[aria-label="Theme Presets"]')),
      },
      {
        id: 'accent-chip',
        when: () => Boolean(document.querySelector('.settings-accent-chip')),
      },
      {
        id: 'background-scope',
        when: () => Boolean(document.querySelector('[data-testid="appearance-background-scope"]')),
      },
      {
        id: 'phase36-proof-checklist',
        when: () => Boolean(document.querySelector('[data-testid="phase36-proof-checklist"]')),
      },
      {
        id: 'duplicate-shell-copy-removed',
        when: () => !(document.body.textContent ?? '').includes(
          'Apply a ready-made shell and surface profile, or import/export your own configuration.',
        ),
      },
    ],
    'Phase 36 settings proof rendered above the real shell with observable checks for duplicate-copy removal, preset predictability, aligned control geometry, and visible-effect scope.',
  );

  return (
    <Phase19ShellFrame mode="simple" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Phase36ProofCallout
          title="Settings closeout must prove observable behavior, not just reassuring copy"
          detail="Use this route to review the live appearance surface and the concrete checks below. The route is only ready when the actual settings shell, preset controls, and visible-effect seams are mounted together."
        />
        <Phase36ProofChecklist
          items={[
            'No duplicated settings-shell intro copy sits above the active tab content.',
            'Preset family, mode, accent, and reset behavior stay predictable on the live appearance surface.',
            'Accent chips, segmented controls, and utility actions keep centered geometry and readable labels.',
            'Background and advanced appearance controls visibly affect the shell frame or backdrop around the modal, or clearly state their limited scope.',
          ]}
        />
        <SettingsPage onClose={() => undefined} initialTab="appearance" />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase24ThemeDarkScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Launcher Settings', 'Theme Presets', 'Dark closeout pair'],
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
    ['FriendLauncher', 'Launcher Settings', 'Theme Presets', 'Light closeout pair'],
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
    ['FriendLauncher', 'Launcher Settings', 'Theme Presets'],
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
    ['FriendLauncher', 'Launcher Settings', 'Theme Presets'],
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
            <h2 className="text-xl font-semibold text-foreground">Search controls wrap cleanly while no-art cards keep a calm shared placeholder</h2>
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
    'Installed catalog proof rendered with a compact header, minimal card facts, and coherent primary actions.',
  );

  return (
    <ModpackProviders>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
        <Phase33ProofCallout
          title="Installed catalog should stay compact and factual"
          detail="Review the installed header for compact controls, then confirm each card stays focused on Minecraft version and Updated context while the primary actions share one geometry."
        />
        <ModpackList onNavigate={() => undefined} onCreateWizard={() => undefined} />
      </div>
    </ModpackProviders>
  );
}

function ModpackCreateScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Create New Modpack', 'Next'],
    'Phase 35 create-wizard proof rendered inside the real shell with a fixed action rail, runtime-aware failure explanations, and explicit post-commit recovery.',
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
    'Remote catalog proof rendered inside the real shell with compact controls, minimal card facts, coherent primary actions, and neutral fallback art.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase33ProofCallout
          title="Remote catalog header and actions should read as one compact system"
          detail="Use this route to verify compact browse controls, minimal card metadata, aligned primary button geometry, and neutral fallback art without falling back to the older dense catalog story."
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
    'Crowded browser proof rendered inside the real shell with dense cards, long labels, and visible neutral fallback artwork.',
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
    ['FriendLauncher', 'Runtime and dependency state', 'Update available', 'Screenshots'],
    'Phase 34 modpack-details proof rendered inside the real shell with tab reachability, first-read runtime authority, and one shared content workspace contract.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase34ProofCallout
          title="Details proof starts on first-read runtime truth, not on a secondary tab"
          detail="Use this route to confirm the info tab already explains runtime and dependency state, tab labels stay readable above the fold, and Mods, Resource Packs, Shaders, Worlds, and Screenshots still feel like one workspace when you switch between them."
        />
        <ModpackDetails
          modpackId="alpha"
          initialTab="info"
          initialMetadata={fixtureMetadata}
          initialMods={fixtureMods}
          hydrateFromIpc={false}
          onBack={() => undefined}
          onNavigate={() => undefined}
          onLaunch={() => undefined}
        />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase21DetailsDensityScenario({ onReady }: ManualVerificationScenarioProps) {
  const fixtureMetadata = useMemo(() => getManualVerificationModpackMetadata('phase-21-details-density'), []);
  const fixtureMods = useMemo(() => getManualVerificationModEntries('phase-21-details-density'), []);

  useReadyByText(
    onReady,
    ['FriendLauncher', PHASE_21_RUNTIME_FIXTURE.name, 'Legacy density regression route'],
    'Phase 21 constrained-width details regression route rendered after the main Phase 34 proof so long metadata and long tab labels can still stress the real shell.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route" language="ru">
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full max-w-[980px] min-w-0 flex-col gap-4">
          <Phase34ProofCallout
            title="Legacy density regression route"
            detail="Use this only after the main Phase 34 details proof passes. It keeps constrained width, long Russian labels, and heavy metadata on screen together so tab reachability regressions still show up under stress."
          />
          <ModpackDetails
            modpackId="alpha"
            initialTab="info"
            initialMetadata={fixtureMetadata}
            initialMods={fixtureMods}
            hydrateFromIpc={false}
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
    'Phase 35 add-content proof rendered inside the real shell with a fixed action rail, retained selections, and itemized mixed-success recovery.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <AddModPage modpackId="alpha" onBack={() => undefined} />
    </Phase19ShellFrame>
  );
}

function GuidedResourcePacksScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Painterly Depth Reloaded', 'Have a local resource pack .zip already?', 'Instance-scoped resource packs'],
    'Phase 35 guided resource-pack browser proof rendered with direct catalog fixtures, explicit local fallback, and runtime-scoped copy on the live route.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase35ProofCallout
          title="Guided resource-pack browsing stays specific to the launcher story"
          detail="Use this route to verify that resource-pack guidance stays on the live route with explicit local fallback, runtime-scoped copy, and no fake compatibility promise or marketplace framing."
        />
        <AddModPage modpackId="alpha" contentType="resourcepack" onBack={() => undefined} />
      </div>
    </Phase19ShellFrame>
  );
}

function GuidedResourcePacksRecoveryScenario({ onReady }: ManualVerificationScenarioProps) {
  useGuidedActionNoticeReady({
    onReady,
    actionNeedle: 'Import local .zip',
    message: 'Phase 35 guided resource-pack fallback proof rendered with partial local-import recovery that stays on-surface.',
  });

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase35ProofCallout
          title="Local fallback now proves recoverable resource-pack failure"
          detail="This proof auto-opens the guided local import path and lands in a partial-success recovery state, so reviewers can see fallback and actionable failure copy together without stepping outside the route shell."
        />
        <AddModPage modpackId="alpha" contentType="resourcepack" onBack={() => undefined} />
      </div>
    </Phase19ShellFrame>
  );
}

function GuidedShadersScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['FriendLauncher', 'Shader runtime', 'Needs setup', 'Photon Bloom Lite', 'Have a local shader pack .zip already?'],
    'Phase 35 guided shader browser proof rendered with needs-setup runtime guidance, shader-specific fixtures, and honest live-route capability copy.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase35ProofCallout
          title="Guided shader browsing now carries honest capability guidance"
          detail="Use this route to verify that the shader browser mounts with runtime-aware capability messaging, keeps local .zip fallback secondary, and stays honest about what FMCL knows or has not confirmed yet."
        />
        <AddModPage modpackId="alpha" contentType="shader" onBack={() => undefined} />
      </div>
    </Phase19ShellFrame>
  );
}

function GuidedShadersRecoveryScenario({ onReady }: ManualVerificationScenarioProps) {
  useGuidedSelectionAndSubmitReady({
    onReady,
    selectionNeedle: 'Photon Bloom Lite',
    actionNeedle: 'Add selected shaders',
    expectedNeedles: [
      'Unsupported',
      'Photon Bloom Lite: This shader is blocked for the current runtime.',
      'Review the shader runtime card above, then retry.',
    ],
    message: 'Phase 35 guided shader recovery proof rendered with unsupported runtime guidance and retry-ready blocked install copy.',
  });

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Phase35ProofCallout
          title="Blocked shader installs stay on-surface with the runtime reason"
          detail="This proof auto-selects a shader fixture and triggers the guided install path under an unsupported runtime so reviewers can see the runtime card, retry-ready recovery copy, and unchanged action rail together."
        />
        <AddModPage modpackId="alpha" contentType="shader" onBack={() => undefined} />
      </div>
    </Phase19ShellFrame>
  );
}

function Phase41OwnershipScenario({
  language,
  onReady,
}: ManualVerificationScenarioProps & { language: 'en' | 'ru' }) {
  const t = createTranslator(language);
  useReadyByChecks(
    onReady,
    [
      {
        id: 'localized-ownership-copy',
        when: () => (document.querySelector('[data-testid="phase41-ownership-proof"]')?.textContent ?? '')
          .includes(t('phase41.ownership_title')),
      },
      {
        id: 'canonical-sidebar-consumer',
        when: () => document.querySelector('aside[data-instance-owner="canonical"]')
          ?.getAttribute('data-selected-instance-id') === 'alpha',
      },
      {
        id: 'canonical-route-consumer',
        when: () => Boolean(document.querySelector('[data-testid="installed-modpack-actions-alpha"]')),
      },
    ],
    `Phase 41 ${language.toUpperCase()} canonical ownership proof rendered with the real shell, route, and shared instance provider.`,
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="shell" language={language}>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6" data-testid="phase41-ownership-proof">
        <Phase41ProofCallout titleKey="phase41.ownership_title" detailKey="phase41.ownership_desc" />
        <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border border-border/70 bg-card/40">
          <ModpackRouter />
        </div>
      </div>
    </Phase19ShellFrame>
  );
}

function Phase41RecoveryScenario({
  language,
  onReady,
}: ManualVerificationScenarioProps & { language: 'en' | 'ru' }) {
  const t = createTranslator(language);
  useReadyByChecks(
    onReady,
    [
      {
        id: 'localized-recovery-copy',
        when: () => (document.querySelector('[data-testid="phase41-recovery-proof"]')?.textContent ?? '')
          .includes(t('phase41.recovery_title')),
      },
      {
        id: 'recovered-record',
        when: () => (document.querySelector('[data-testid="operation-recovery-inbox"]')?.textContent ?? '')
          .includes(t('operations.recovery_inbox_recovered')),
      },
      {
        id: 'recovery-required-record',
        when: () => (document.querySelector('[data-testid="operation-recovery-inbox"]')?.textContent ?? '')
          .includes(t('operations.recovery_inbox_required')),
      },
    ],
    `Phase 41 ${language.toUpperCase()} production recovery proof rendered with recovered and recovery-required journal records.`,
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="shell" language={language}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6" data-testid="phase41-recovery-proof">
        <Phase41ProofCallout titleKey="phase41.recovery_title" detailKey="phase41.recovery_desc" />
        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-3xl border border-border/70 bg-card/40">
          <ModpackList onNavigate={() => undefined} onCreateWizard={() => undefined} />
        </div>
      </div>
    </Phase19ShellFrame>
  );
}

function Phase41SurfacesScenario({
  language,
  onReady,
}: ManualVerificationScenarioProps & { language: 'en' | 'ru' }) {
  const t = createTranslator(language);
  useReadyByChecks(
    onReady,
    [
      {
        id: 'localized-surfaces-copy',
        when: () => (document.querySelector('[data-testid="phase41-surfaces-proof"]')?.textContent ?? '')
          .includes(t('phase41.surfaces_title')),
      },
      { id: 'appearance-surface', when: () => Boolean(document.querySelector('[data-testid="appearance-primary-grid"]')) },
      { id: 'details-surface', when: () => Boolean(document.querySelector('[data-testid="modpack-details-hero"]')) },
      { id: 'content-surface', when: () => Boolean(document.querySelector('[data-testid="add-mod-page-body"]')) },
    ],
    `Phase 41 ${language.toUpperCase()} split-surface proof rendered with real Appearance, Details, and content acquisition components.`,
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route" language={language}>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" data-testid="phase41-surfaces-proof">
        <Phase41ProofCallout titleKey="phase41.surfaces_title" detailKey="phase41.surfaces_desc" />

        <section className="surface-panel min-w-0 space-y-4 rounded-3xl p-4 sm:p-5" data-testid="phase41-appearance-surface">
          <h3 className="text-base font-semibold text-foreground">{t('phase41.surface_appearance')}</h3>
          <AppearanceTab embedded />
        </section>

        <section className="surface-panel min-h-[48rem] min-w-0 space-y-4 overflow-hidden rounded-3xl p-4 sm:p-5" data-testid="phase41-details-surface">
          <h3 className="text-base font-semibold text-foreground">{t('phase41.surface_details')}</h3>
          <div className="flex min-h-[42rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70">
            <ModpackDetails modpackId="alpha" onBack={() => undefined} onNavigate={() => undefined} />
          </div>
        </section>

        <section className="surface-panel min-h-[48rem] min-w-0 space-y-4 overflow-hidden rounded-3xl p-4 sm:p-5" data-testid="phase41-content-surface">
          <h3 className="text-base font-semibold text-foreground">{t('phase41.surface_content')}</h3>
          <div className="flex min-h-[42rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70">
            <AddModPage modpackId="alpha" contentType="resourcepack" onBack={() => undefined} />
          </div>
        </section>
      </div>
    </Phase19ShellFrame>
  );
}

function OperationRecoveryScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Operation recovery', 'Recovered after restart', 'Needs manual attention', 'Export authorization cannot be replayed'],
    'Phase 41 startup recovery inbox rendered from production ownership with distinct recovered and manual-attention records and no generic replay action.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="shell">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
        <Phase35ProofCallout
          title="Recovered work stays visible outside its original route"
          detail="The production provider reads journal recovery once, refreshes canonical instance state only for a proven durable commit, and leaves uncertain recovery available for explicit inspection or dismissal."
        />
        <div className="mt-4 min-h-0 flex-1 overflow-hidden">
          <ModpackList onNavigate={() => undefined} onCreateWizard={() => undefined} />
        </div>
      </div>
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
      <>
        <div className="mx-6 mt-4 rounded-md border border-border/70 bg-card/70 p-3 text-sm text-secondary" data-testid="archive-reference-proof">
          Archive references are single-use and sender-bound: forged, reused, or expired references are rejected before import starts. After restarting the app, inspect the archive again to obtain a new reference.
        </div>
        <ImportModpackPreviewPage
          archiveRef={MANUAL_ARCHIVE_REFERENCE}
          inspection={MANUAL_ARCHIVE_INSPECTION}
          onBack={() => undefined}
        />
      </>
    </Phase19ShellFrame>
  );
}

function AddModModalScenario({ onReady }: ManualVerificationScenarioProps) {
  const fixtureMetadata = useMemo(() => getManualVerificationModpackMetadata('modpack-details'), []);
  const fixtureMods = useMemo(() => getManualVerificationModEntries('modpack-details'), []);

  useReadyByText(
    onReady,
    ['FriendLauncher', 'Gamma Runtime', 'Add mods', 'Sodium'],
    'Phase 35 add-mod modal proof rendered over the real shell with a fixed action rail, locked exits during install, and on-surface mixed-success recovery.',
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
            instanceId="alpha"
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
    ['FriendLauncher', 'Installed Resource Packs', 'Legacy secondary-workspace regression route'],
    MEDIA_FALLBACK_PATH,
    1,
    'Phase 21 secondary-content regression route rendered after the main Phase 34 proof so dense resource-pack rows and fallback art can still stress the shared workspace.',
  );

  return (
    <Phase19ShellFrame mode="modpacks" ownership="route">
      <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full max-w-[1120px] min-w-0 flex-col gap-4">
          <Phase34ProofCallout
            title="Legacy secondary-workspace regression route"
            detail="Use this after the main Phase 34 details proof to stress dense resource-pack rows, mixed artwork states, and shared-workspace grammar without mistaking this route for the current success criteria."
          />
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ResourcePacksTab
              instanceId="alpha"
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
          instanceId="alpha"
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
          instanceId="alpha"
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
          instanceId="alpha"
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
          instanceId="alpha"
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
            <ScreenshotsTab instanceId="alpha" />
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
        <ScreenshotsTab instanceId="alpha" />
      </div>
    </SettingsProviders>
  );
}

function UtilitiesScenario({ onReady }: ManualVerificationScenarioProps) {
  useReadyByText(
    onReady,
    ['Download mirrors', 'Popular Modpacks', 'Alpha Pack'],
    'Phase 36 utility proof rendered with task-focused mirrors and statistics surfaces inside the shared settings contract.',
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
        instanceId="alpha"
        worldFolder="AlphaWorld"
        worldName="Alpha World"
      />
    </SettingsProviders>
  );
}

function Phase42NetworkScenario({ view, onReady }: ManualVerificationScenarioProps & { view: 'phase-42-tunnel-en' | 'phase-42-lan-ru' }) {
  const isLan = view === 'phase-42-lan-ru';
  useReadyByText(
    onReady,
    isLan ? ['Мультиплеер', 'Мир Beta Pack', '192.168.1.42:25565'] : ['Multiplayer', 'Room Active!', 'abababab'],
    `Phase 42 ${isLan ? 'RU LAN discovery' : 'EN FriendTunnel'} live-state surface rendered from the typed network capability fixture.`,
  );
  return <ModpackProviders><MultiplayerPage onBack={() => undefined} /></ModpackProviders>;
}

export function ManualVerificationScenarios(props: { view: ManualVerificationView; onReady: (message: string) => void }) {
  const scenarioProps = { onReady: props.onReady };

  if (props.view === 'phase-42-tunnel-en' || props.view === 'phase-42-lan-ru') {
    return <Phase42NetworkScenario {...scenarioProps} view={props.view} />;
  }

  if (props.view === 'phase-41-ownership-en') {
    return <Phase41OwnershipScenario {...scenarioProps} language="en" />;
  }

  if (props.view === 'phase-41-ownership-ru') {
    return <Phase41OwnershipScenario {...scenarioProps} language="ru" />;
  }

  if (props.view === 'phase-41-recovery-en') {
    return <Phase41RecoveryScenario {...scenarioProps} language="en" />;
  }

  if (props.view === 'phase-41-recovery-ru') {
    return <Phase41RecoveryScenario {...scenarioProps} language="ru" />;
  }

  if (props.view === 'phase-41-surfaces-en') {
    return <Phase41SurfacesScenario {...scenarioProps} language="en" />;
  }

  if (props.view === 'phase-41-surfaces-ru') {
    return <Phase41SurfacesScenario {...scenarioProps} language="ru" />;
  }

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

  if (props.view === 'guided-resourcepacks') {
    return <GuidedResourcePacksScenario {...scenarioProps} />;
  }

  if (props.view === 'guided-resourcepacks-recovery') {
    return <GuidedResourcePacksRecoveryScenario {...scenarioProps} />;
  }

  if (props.view === 'guided-shaders') {
    return <GuidedShadersScenario {...scenarioProps} />;
  }

  if (props.view === 'guided-shaders-recovery') {
    return <GuidedShadersRecoveryScenario {...scenarioProps} />;
  }

  if (props.view === 'operation-recovery') {
    return <OperationRecoveryScenario {...scenarioProps} />;
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
