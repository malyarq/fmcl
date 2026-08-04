// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModModal } from '../AddModModal';
import { AddModPage } from '../AddModPage';

const searchModsMock = vi.fn();
const getModVersionsMock = vi.fn();
const getMetadataMock = vi.fn();
const getConfigMock = vi.fn();
const t = createTranslator('en');
const marketplaceFramingPattern = /\b(marketplace|wishlist|store|storefront)\b/i;

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: (...args: unknown[]) => getModVersionsMock(...args),
    installModFile: vi.fn(),
  },
}));

describe('Add-mod placeholder truth', () => {
  beforeEach(() => {
    mockMatchMedia();
    searchModsMock.mockReset();
    getModVersionsMock.mockReset();
    getMetadataMock.mockReset();
    getConfigMock.mockReset();

    getMetadataMock.mockResolvedValue({
      id: 'alpha',
      name: 'Alpha Pack',
      source: 'local',
      minecraftVersion: '1.20.1',
      modLoader: { type: 'fabric' },
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-13T00:00:00.000Z',
    });
    getConfigMock.mockResolvedValue({
      id: 'alpha',
      name: 'Alpha Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: { type: 'fabric' },
      },
    });
  });

  it('replaces suspicious selected version names with a safe fallback label in the modal', async () => {
    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'iris',
          title: 'Iris',
          description: 'Shader loader',
        },
      ],
      total: 1,
    });
    getModVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'version-1',
        name: '${file.jarVersion}',
        versionNumber: '1.2.0',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
      },
    ]);

    render(
      <AddModModal
        modpackId="alpha"
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Iris')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox'));

    const results = await screen.findByTestId('add-mod-modal-results');
    await waitFor(() => {
      expect(
        within(results).getByText((_, element) => (
          element?.tagName === 'P'
          && (element.textContent ?? '').includes('1.2.0 (1.20.1)')
        )),
      ).toBeTruthy();
    });
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull();
  });

  it('shows a degraded search error on the route page instead of leaking wrapper placeholders', async () => {
    searchModsMock.mockRejectedValue(new Error('[modsIPC] searchMods failed: ${file.jarVersion}'));

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    expect(await screen.findByRole('heading', { name: 'Unable to search right now' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('We could not load catalog results right now.');
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull();
  });

  it('uses resource-pack route copy instead of mod-centric empty-state placeholders', async () => {
    searchModsMock.mockResolvedValue({ items: [], total: 0 });

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="resourcepack" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    expect(await screen.findByRole('heading', { name: 'Browse resource packs' })).toBeTruthy();
    expect(screen.getByText('Search Modrinth or import a local .zip to add a resource pack to this modpack.')).toBeTruthy();
    expect(screen.queryByText(/loader-compatible files/i)).toBeNull();
    expect(screen.queryByText(/No mods found/i)).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(marketplaceFramingPattern);
  });

  it('uses resource-pack-specific add action labels on the guided route', async () => {
    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'faithful',
          title: 'Faithful 64x',
          description: 'Sharper textures',
        },
      ],
      total: 1,
    });
    getModVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'resourcepack-1',
        name: '1.0.0',
        mcVersions: ['1.20.1'],
        loaders: [],
      },
    ]);

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="resourcepack" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    fireEvent.click(screen.getByRole('checkbox'));

    expect(await screen.findByRole('button', { name: 'Add selected resource packs (1)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add selected (1)' })).toBeNull();
  });

  it('uses shader-specific add action labels on the guided route', async () => {
    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'complementary',
          title: 'Complementary Reimagined',
          description: 'Cinematic lighting',
        },
      ],
      total: 1,
    });
    getModVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'shader-1',
        name: '1.0.0',
        mcVersions: ['1.20.1'],
        loaders: [],
      },
    ]);

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="shader" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    fireEvent.click(screen.getByRole('checkbox'));

    expect(await screen.findByRole('button', { name: 'Add selected shaders (1)' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add selected (1)' })).toBeNull();
    expect(document.body.textContent ?? '').not.toMatch(marketplaceFramingPattern);
  });
});
