// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackBrowser } from '../ModpackBrowser';
import { ModpackList } from '../ModpackList';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { createTranslator } from '../../../contexts/settings/i18n';

const searchModrinthMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const getModrinthVersionsMock = vi.fn();
const listWithMetadataMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const t = createTranslator('en');

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

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    modpacks: [
      { id: 'alpha', name: 'Alpha Pack' },
      { id: 'beta', name: 'Beta Pack' },
    ],
    selectedId: 'beta',
    select: (...args: unknown[]) => selectMock(...args),
    remove: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    refresh: (...args: unknown[]) => refreshMock(...args),
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

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    searchModrinth: (...args: unknown[]) => searchModrinthMock(...args),
    getCurseForgeVersions: (...args: unknown[]) => getCurseForgeVersionsMock(...args),
    getModrinthVersions: (...args: unknown[]) => getModrinthVersionsMock(...args),
    listWithMetadata: (...args: unknown[]) => listWithMetadataMock(...args),
  },
}));

vi.mock('../../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('../../../features/share/ShareModal', () => ({
  ShareModal: () => null,
}));

vi.mock('../../../features/share/ImportShareModal', () => ({
  ImportShareModal: () => null,
}));

function renderBrowser(overrides: Partial<ComponentProps<typeof ModpackBrowser>> = {}) {
  render(
    <ModpackBrowser
      initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth', ...overrides.initialState }}
      onBack={vi.fn()}
      onNavigate={vi.fn()}
      onStateChange={vi.fn()}
    />,
  );
}

describe('ModpackCatalogControls shared contract', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    searchModrinthMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    getModrinthVersionsMock.mockReset();
    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    searchModrinthMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'alpha-remote',
          title: 'Alpha Pack',
          dateModified: '2026-04-11T10:00:00.000Z',
        },
      ],
      total: 1,
      offset: 0,
      limit: 12,
    });
    getCurseForgeVersionsMock.mockResolvedValue([]);
    getModrinthVersionsMock.mockResolvedValue([]);
    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: false,
        metadata: {
          version: '1.2.0',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          updatedAt: '2026-04-12T12:00:00.000Z',
        },
      },
    ]);
  });

  it('marks the installed catalog as using the shared compact controls shell', async () => {
    render(<ModpackList />);

    await screen.findByText('Alpha Pack');

    const controls = screen.getByTestId('installed-modpack-filter-controls');
    expect(screen.getByTestId('installed-modpack-filters').getAttribute('data-catalog-controls')).toBe('shared');
    expect(controls.getAttribute('data-catalog-controls-layout')).toBe('compact-shared');
    expect(controls.className).toContain('lg:flex-row');
    expect(screen.queryByTestId('installed-modpack-summary')).toBeNull();
  });

  it('marks the remote catalog as using the shared compact controls shell', async () => {
    renderBrowser({
      initialState: {
        ...DEFAULT_MODPACK_BROWSER_STATE,
        query: 'alpha',
        filterMCVersion: '1.20.1',
        filterLoader: 'fabric',
      },
    });

    await screen.findByText('Alpha Pack');

    const controls = screen.getByTestId('remote-modpack-filter-controls');
    expect(screen.getByTestId('remote-modpack-filters').getAttribute('data-catalog-controls')).toBe('shared');
    expect(controls.getAttribute('data-catalog-controls-layout')).toBe('compact-shared');
    expect(controls.className).toContain('lg:flex-row');
    expect(screen.queryByTestId('remote-modpack-summary')).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });
});
