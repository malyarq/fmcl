// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import routeSource from '../ModpackList.tsx?raw';
import controllerSource from '../list/useInstalledModpackCatalog.ts?raw';
import menuSource from '../list/InstalledModpackContextMenu.tsx?raw';
import serviceSource from '../../../features/modpacks/services/installedModpackCatalogService.ts?raw';
import { createTranslator } from '../../../contexts/settings/i18n';
import { MEDIA_FALLBACK_PATH } from '../../../app/assets/branding';
import { instancesFromListFixture } from './instancesListFixture';

const listWithMetadataMock = vi.fn();
const providerVersionsMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({ status: 'ready', data: [{
    id: 'alpha',
    name: 'Alpha Pack',
    selected: false,
    summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } },
  }] }),
  useSelectedInstanceId: () => ({ status: 'ready', data: '' }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../contexts/instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({
    select: (...args: unknown[]) => selectMock(...args),
    remove: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
  }),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
    prompt: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/providerCatalogIPC', () => ({
  providerCatalogIPC: {
    versions: (...args: unknown[]) => providerVersionsMock(...args),
  },
}));

vi.mock('../../../features/share/ShareModal', () => ({
  ShareModal: () => null,
}));

vi.mock('../../../features/share/ImportShareModal', () => ({
  ImportShareModal: () => null,
}));

describe('ModpackList ergonomics', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', { configurable: true, value: { instances: instancesFromListFixture(() => listWithMetadataMock()) } });
    cleanup();
    listWithMetadataMock.mockReset();
    providerVersionsMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    providerVersionsMock.mockResolvedValue([]);
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: false,
        metadata: {
          description: 'Route truth test pack',
          version: '1.2.0',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          updatedAt: '2026-04-12T12:00:00.000Z',
        },
      },
    ]);
  });

  it('keeps the route as composition while focused catalog owners hold behavior', () => {
    expect(routeSource).toContain('useInstalledModpackCatalog');
    expect(routeSource).toContain('InstalledModpackCatalog');
    expect(routeSource).toContain('InstalledModpackContextMenu');
    expect(routeSource).not.toContain('instancesIPC');
    expect(routeSource).not.toContain('AnchoredRect');
    expect(controllerSource).toContain('loadInstalledModpackCatalog');
    expect(controllerSource).not.toContain('instancesIPC');
    expect(controllerSource).not.toContain('archiveInspectionIPC');
    expect(serviceSource).toContain('instancesIPC');
    expect(menuSource).toContain('AnchoredOverlay');
    expect(menuSource).toContain('requestAnimationFrame');
  });

  it('keeps installed catalog controls grouped and card metadata labeled at sidebar widths', async () => {
    render(<ModpackList />);

    await screen.findByText('Alpha Pack');

    const searchRegion = screen.getByRole('search', { name: 'Search modpacks' });
    const searchHeader = within(searchRegion).getByTestId('installed-modpack-catalog-header');
    const controlsGrid = within(searchRegion).getByTestId('installed-modpack-filter-controls');
    const card = screen.getByRole('button', { name: 'Open details: Alpha Pack' }).closest('[role="listitem"]');

    expect(card).not.toBeNull();
    expect(searchRegion.getAttribute('data-catalog-controls')).toBe('shared');
    expect(searchHeader).toBeTruthy();
    expect(within(searchRegion).getByTestId('installed-modpack-primary-actions').className).toContain('flex-wrap');
    expect(controlsGrid.getAttribute('data-catalog-controls-layout')).toBe('compact-shared');
    expect(controlsGrid.className).toContain('lg:flex-row');
    expect(within(searchRegion).getByText('Search modpacks')).toBeTruthy();
    expect(within(searchRegion).getByText('Minecraft Version')).toBeTruthy();
    expect(within(searchRegion).getByText('Modloader')).toBeTruthy();
    expect(screen.queryByText(/Showing\s+\d/i)).toBeNull();
    expect(screen.queryByText(/^Active:/i)).toBeNull();
    expect(screen.getByTestId('installed-modpack-actions-alpha').className).toContain('grid');
    expect(screen.getByRole('button', { name: 'Make active: Alpha Pack' })).toBeTruthy();

    const cardScope = within(card as HTMLElement);
    expect(cardScope.getByText('Minecraft Version')).toBeTruthy();
    expect(cardScope.getByText('Updated')).toBeTruthy();
    expect(cardScope.queryByText('CurseForge')).toBeNull();
    expect(cardScope.queryByText('Modrinth')).toBeNull();
    expect(cardScope.queryByText('Version')).toBeNull();
    expect(cardScope.queryByText('Modloader')).toBeNull();

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Alpha Pack' }).getAttribute('src')).toBe(MEDIA_FALLBACK_PATH);
    });
  });

  it('surfaces available updates on the modpack card instead of a global shell banner', async () => {
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: false,
        metadata: {
          description: 'Route truth test pack',
          version: '1.2.0',
          source: 'modrinth',
          sourceId: 'alpha-pack',
          sourceVersionId: 'release-1',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
        },
      },
    ]);
    providerVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'release-2',
        name: '1.3.0',
        versionNumber: '1.3.0',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
        files: [],
      },
    ]);

    render(<ModpackList />);

    await screen.findByRole('button', { name: 'Open details: Alpha Pack' });

    await waitFor(() => {
      expect(screen.getByTestId('installed-modpack-update-indicator-alpha')).toBeTruthy();
    });

    expect(providerVersionsMock).toHaveBeenCalledWith({ platform: 'modrinth', projectId: 'alpha-pack' });

    const updateIndicator = screen.getByTestId('installed-modpack-update-indicator-alpha');
    expect(updateIndicator.getAttribute('data-update-scope')).toBe('modpack-local');
    expect(updateIndicator.className).not.toContain('rounded-full');
    expect(updateIndicator.textContent).toContain('Update available');
    expect(screen.queryByTestId('app-update-notification')).toBeNull();
  });
});
