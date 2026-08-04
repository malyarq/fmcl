// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackDetails } from '../ModpackDetails';

const t = createTranslator('en');
const loadModpackConfigMock = vi.fn();
const refreshMock = vi.fn();
const selectMock = vi.fn();
const screenshotsListMock = vi.fn();

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    minecraftPath: '/minecraft',
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
  }),
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpack: () => ({
    modpacks: [
      {
        id: 'dense-pack',
        name: 'The Unreasonably Long Modpack Title That Used To Collapse The Details Header Under Desktop Pressure',
        path: '/instances/dense-pack',
      },
    ],
    select: (...args: unknown[]) => selectMock(...args),
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    refresh: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
    prompt: vi.fn(),
  }),
}));

vi.mock('../../../features/modpacks/hooks/useModpackDetailsConfig', () => ({
  useModpackDetailsConfig: () => ({
    effectiveConfig: {
      runtime: {
        minecraft: '1.20.1',
        modLoader: {
          type: 'fabric',
          version: '0.16.9',
        },
      },
    },
    loadModpackConfig: (...args: unknown[]) => loadModpackConfigMock(...args),
    setters: {},
  }),
}));

vi.mock('../../../features/launcher/hooks/useVersions', () => ({
  useVersions: () => ({
    versions: [],
  }),
}));

vi.mock('../../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [],
    fabricVersions: [],
    neoForgeVersions: [],
    optiFineVersions: [],
  }),
}));

vi.mock('../../../services/ipc/screenshotsIPC', () => ({
  screenshotsIPC: {
    list: (...args: unknown[]) => screenshotsListMock(...args),
    delete: vi.fn(),
    rename: vi.fn(),
    openFolder: vi.fn(),
  },
}));

describe('Modpack details density', () => {
  beforeEach(() => {
    loadModpackConfigMock.mockReset();
    refreshMock.mockReset();
    selectMock.mockReset();
    loadModpackConfigMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    selectMock.mockResolvedValue(undefined);
    screenshotsListMock.mockReset();
    screenshotsListMock.mockResolvedValue([]);
  });

  it('keeps metadata, tabs, and route actions as one labeled hierarchy under constrained width', () => {
    render(
      <div style={{ width: '960px' }}>
        <ModpackDetails
          modpackId="dense-pack"
          onBack={vi.fn()}
          onNavigate={vi.fn()}
          hydrateFromIpc={false}
          initialTab="info"
          initialMetadata={{
            id: 'dense-pack',
            name: 'The Unreasonably Long Modpack Title That Used To Collapse The Details Header Under Desktop Pressure',
            version: '2026.04.18-release-candidate-with-an-extraordinarily-long-runtime-name',
            minecraftVersion: '1.20.1',
            modLoader: {
              type: 'fabric',
              version: '0.16.9',
            },
            author: 'Dense Surface Quality Group',
            source: 'local',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            description: 'A long-form modpack summary used to keep the details route under pressure.',
          }}
        />
      </div>,
    );

    const hero = screen.getByTestId('modpack-details-hero');
    const routeTop = screen.getByTestId('modpack-details-route-top');
    expect(hero.className).toContain('surface-card');
    expect(hero.className).toContain('lg:grid-cols-[minmax(0,1fr)_15rem]');
    expect(routeTop.className).not.toContain('flex-col');
    expect(routeTop.textContent).not.toContain('Modpack details');

    const metadata = screen.getByTestId('modpack-details-metadata');
    expect(metadata.textContent).toContain('Version');
    expect(metadata.textContent).toContain('Minecraft Version');
    expect(metadata.textContent).toContain('Modloader');
    expect(metadata.textContent).toContain('Author');

    const tablist = screen.getByTestId('modpack-details-tablist');
    expect(tablist.className).toContain('flex');
    expect(tablist.className).toContain('flex-wrap');
    expect(tablist.className).not.toContain('grid');
    expect(screen.queryByText('Manage mods, packs, shaders, and worlds from one consistent content workspace.')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Resource packs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Screenshots' })).toBeTruthy();
    expect(tablist.closest('[data-testid="modpack-details-hero"]')).toBe(hero);

    const actions = screen.getByTestId('modpack-details-actions');
    expect(actions.className).not.toContain('surface-card');
    expect(actions.textContent).toContain('More actions');
    expect(actions.textContent).toContain('Play');
    expect(screen.getByRole('button', { name: 'Play' }).closest('[data-testid="modpack-details-hero"]')).toBe(hero);
    expect(document.querySelectorAll('[data-primary-action="route"]')).toHaveLength(1);
  });

  it('keeps screenshots inside the shared secondary content host instead of a foreign route panel', async () => {
    render(
      <ModpackDetails
        modpackId="dense-pack"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
        hydrateFromIpc={false}
        initialTab="screenshots"
        initialMetadata={{
          id: 'dense-pack',
          name: 'Dense Pack',
          minecraftVersion: '1.20.1',
          source: 'local',
          createdAt: '2026-04-18T00:00:00.000Z',
          updatedAt: '2026-04-18T00:00:00.000Z',
        }}
      />,
    );

    const contentHost = screen.getByTestId('modpack-details-content-host');
    expect(contentHost.getAttribute('data-content-surface')).toBe('secondary');
    expect(contentHost.className).toContain('space-y-4');
    expect(contentHost.className).not.toContain('surface-panel');

    expect(await screen.findByTestId('screenshots-workspace-shell')).toBeTruthy();
  });
});
