// @vitest-environment jsdom

import { useState, type ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import appSource from '../../../App.tsx?raw';
import { AppRecoveryBoundary } from '../../../App';
import { ConfirmProvider } from '../../../contexts/ConfirmContext';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { InstanceQueryProvider } from '../../../features/instances/InstanceQueryProvider';
import { ModpackNavigationProvider } from '../../../features/modpacks/navigation/ModpackNavigationProvider';
import { OperationRecoveryProvider } from '../../../features/operations/recovery/OperationRecoveryProvider';
import { ModpackRouter } from '../../../components/modpacks/ModpackRouter';
import { installManualVerificationEnvironment, seedManualVerificationStorage } from '../mockEnvironment';
import { ManualVerificationScenarios } from '../scenarios';
import { CORE_VIEWS, type ManualVerificationView } from '../views';

type ProofLanguage = 'en' | 'ru';

const copy = {
  en: {
    makeActive: 'Make active: Beta Pack',
    activeNow: 'Active now: Beta Pack',
    recovered: 'Recovered after restart',
    recoveryRequired: 'Needs manual attention',
    ownershipTitle: 'One canonical instance state across the shell and route',
    recoveryTitle: 'Recovered work stays visible without resetting the route',
    surfacesTitle: 'Split surfaces keep their keyboard and narrow-layout contracts',
    appearancePreset: 'Theme Presets',
    detailsInfo: 'Information',
    detailsMods: 'Mods',
    contentSearch: 'Search',
  },
  ru: {
    makeActive: 'Сделать активным: Beta Pack',
    activeNow: 'Уже активен: Beta Pack',
    recovered: 'Восстановлено после перезапуска',
    recoveryRequired: 'Требует ручной проверки',
    ownershipTitle: 'Единое каноническое состояние сборок в оболочке и маршруте',
    recoveryTitle: 'Восстановленные операции остаются видимыми без сброса маршрута',
    surfacesTitle: 'Разделённые поверхности сохраняют клавиатурные и узкие компоновки',
    appearancePreset: 'Готовые темы',
    detailsInfo: 'Информация',
    detailsMods: 'Моды',
    contentSearch: 'Поиск',
  },
} as const;

function installProof(view: ManualVerificationView) {
  window.history.replaceState({}, '', `/manual-proof?view=${view}`);
  localStorage.clear();
  seedManualVerificationStorage(view);
  installManualVerificationEnvironment();
}

function renderProof(view: ManualVerificationView) {
  installProof(view);
  const onReady = vi.fn();
  const rendered = render(<ManualVerificationScenarios view={view} onReady={onReady} />);
  return { ...rendered, onReady };
}

function RealRouteRecoveryHarness() {
  const [crash, setCrash] = useState(false);

  if (crash) {
    throw new Error('sanitized route proof failure');
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button type="button" onClick={() => setCrash(true)}>Trigger route failure</button>
      <ModpackRouter />
    </div>
  );
}

function RealRendererProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <InstanceQueryProvider>
        <ModpackNavigationProvider>
          <ToastProvider suppressToasts>
            <ConfirmProvider>
              <OperationRecoveryProvider>{children}</OperationRecoveryProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ModpackNavigationProvider>
      </InstanceQueryProvider>
    </SettingsProvider>
  );
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Phase 41 renderer ownership proof', () => {
  it('registers paired ownership, recovery, and split-surface proof views', () => {
    expect(CORE_VIEWS.filter((view) => view.id.startsWith('phase-41-')).map((view) => ({
      id: view.id,
      language: view.language,
    }))).toEqual([
      { id: 'phase-41-ownership-en', language: 'en' },
      { id: 'phase-41-ownership-ru', language: 'ru' },
      { id: 'phase-41-recovery-en', language: 'en' },
      { id: 'phase-41-recovery-ru', language: 'ru' },
      { id: 'phase-41-surfaces-en', language: 'en' },
      { id: 'phase-41-surfaces-ru', language: 'ru' },
    ]);
  });

  it.each(['en', 'ru'] satisfies ProofLanguage[])(
    'publishes one canonical instance selection to the %s shell and real route consumers',
    async (language) => {
      const view = `phase-41-ownership-${language}` as ManualVerificationView;
      installProof(view);
      const list = vi.spyOn(window.api.instances, 'list');
      const select = vi.spyOn(window.api.instances, 'select');
      const onReady = vi.fn();

      const rendered = render(<ManualVerificationScenarios view={view} onReady={onReady} />);

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledWith(
          `Phase 41 ${language.toUpperCase()} canonical ownership proof rendered with the real shell, route, and shared instance provider.`,
        );
      }, { timeout: 4000 });
      expect(rendered.container.textContent).toContain(copy[language].ownershipTitle);
      expect(list).toHaveBeenCalledTimes(1);

      fireEvent.click(await screen.findByRole('button', { name: copy[language].makeActive }));

      await waitFor(() => expect(select).toHaveBeenCalledWith({ id: 'beta' }));
      await waitFor(() => expect(screen.getByRole('button', { name: copy[language].activeNow })).toBeTruthy());
      await waitFor(() => {
        expect(document.querySelector('aside[data-instance-owner="canonical"]')
          ?.getAttribute('data-selected-instance-id')).toBe('beta');
      });
      expect(list).toHaveBeenCalledTimes(2);
      expect(rendered.container.textContent).not.toContain('phase41.');
      expect(rendered.container.textContent).not.toContain('/Users/');
    },
  );

  it.each(['en', 'ru'] satisfies ProofLanguage[])(
    'renders the production recovery owner and distinct %s journal outcomes without replay',
    async (language) => {
      const view = `phase-41-recovery-${language}` as ManualVerificationView;
      const { container, onReady } = renderProof(view);

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledWith(
          `Phase 41 ${language.toUpperCase()} production recovery proof rendered with recovered and recovery-required journal records.`,
        );
      }, { timeout: 4000 });

      const inbox = screen.getByTestId('operation-recovery-inbox');
      expect(container.textContent).toContain(copy[language].recoveryTitle);
      expect(inbox.textContent).toContain(copy[language].recovered);
      expect(inbox.textContent).toContain(copy[language].recoveryRequired);
      expect(within(inbox).queryByRole('button', { name: /retry|повтор/i })).toBeNull();
      expect(container.textContent).not.toContain('/Users/');
      expect(container.textContent).not.toContain('node_modules');
    },
  );

  it.each(['en', 'ru'] satisfies ProofLanguage[])(
    'keeps the real %s Appearance, Details, and content surfaces keyboard reachable at narrow-first geometry',
    async (language) => {
      const view = `phase-41-surfaces-${language}` as ManualVerificationView;
      const { container, onReady } = renderProof(view);

      await waitFor(() => {
        expect(onReady).toHaveBeenCalledWith(
          `Phase 41 ${language.toUpperCase()} split-surface proof rendered with real Appearance, Details, and content acquisition components.`,
        );
      }, { timeout: 4000 });

      expect(container.textContent).toContain(copy[language].surfacesTitle);
      const appearanceGrid = screen.getByTestId('appearance-primary-grid');
      expect(appearanceGrid.className).toContain('grid-cols-1');
      const preset = screen.getByRole('combobox', { name: copy[language].appearancePreset });
      preset.focus();
      expect(document.activeElement).toBe(preset);

      const infoTab = await screen.findByRole('tab', { name: copy[language].detailsInfo });
      fireEvent.keyDown(infoTab, { key: 'ArrowRight' });
      const modsTab = screen.getByRole('tab', { name: copy[language].detailsMods });
      await waitFor(() => {
        expect(modsTab.getAttribute('aria-selected')).toBe('true');
        expect(document.activeElement).toBe(modsTab);
      });

      const contentSearch = await screen.findByRole('searchbox', { name: copy[language].contentSearch });
      contentSearch.focus();
      expect(document.activeElement).toBe(contentSearch);
      expect(screen.getByTestId('phase41-content-surface').className).toContain('min-w-0');
      expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
      expect(container.textContent).not.toContain('phase41.');
      expect(container.textContent).not.toContain('/Users/');
    },
  );

  it('recovers the real details route in place and keeps browser reload outside the renderer boundary', async () => {
    installProof('phase-41-recovery-en');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <RealRendererProviders>
        <AppRecoveryBoundary>
          <RealRouteRecoveryHarness />
        </AppRecoveryBoundary>
      </RealRendererProviders>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Open details: Alpha Pack' }));
    expect(await screen.findByRole('tab', { name: 'Information' })).toBeTruthy();
    const locationBeforeRecovery = window.location.href;

    fireEvent.click(screen.getByRole('button', { name: 'Trigger route failure' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Recover screen' }));

    expect(await screen.findByRole('tab', { name: 'Information' })).toBeTruthy();
    expect(window.location.href).toBe(locationBeforeRecovery);
    expect(appSource).not.toContain('window.location.reload');
    expect(consoleError).toHaveBeenCalled();
  });
});
