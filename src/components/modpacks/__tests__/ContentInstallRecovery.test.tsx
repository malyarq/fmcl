// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModPage } from '../AddModPage';

const searchModsMock = vi.fn();
const getModVersionsMock = vi.fn();
const installModFileMock = vi.fn();
const getMetadataMock = vi.fn();
const getConfigMock = vi.fn();
const resourcePackAddMock = vi.fn();
const shaderAddMock = vi.fn();
const registerModMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
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
    t: createTranslator('en'),
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  }),
}));

vi.mock('../../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: (...args: unknown[]) => getModVersionsMock(...args),
    installModFile: (...args: unknown[]) => installModFileMock(...args),
  },
  isGuidedContentInstallResult: (value: unknown) => Boolean(
    value
    && typeof value === 'object'
    && 'status' in (value as Record<string, unknown>)
    && Array.isArray((value as Record<string, unknown>).issues),
  ),
}));

vi.mock('../../../services/ipc/instanceModsIPC', () => ({
  instanceModsIPC: {
    register: (...args: unknown[]) => registerModMock(...args),
  },
}));

vi.mock('../../../contexts/instances/services/instancesService', () => ({
  fetchModpackMetadata: (...args: unknown[]) => getMetadataMock(...args),
  fetchModpackConfig: (...args: unknown[]) => getConfigMock(...args),
}));

vi.mock('../../../services/ipc/resourcePacksIPC', () => ({
  resourcePacksIPC: {
    add: (...args: unknown[]) => resourcePackAddMock(...args),
  },
}));

vi.mock('../../../services/ipc/shadersIPC', () => ({
  shadersIPC: {
    add: (...args: unknown[]) => shaderAddMock(...args),
  },
}));

vi.mock('../../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [],
    fabricVersions: [],
    neoForgeVersions: [],
    optiFineVersions: ['1.20.1'],
    isLoading: false,
  }),
}));

describe('content install recovery', () => {
  beforeEach(() => {
    mockMatchMedia();

    searchModsMock.mockReset();
    getModVersionsMock.mockReset();
    installModFileMock.mockReset();
    getMetadataMock.mockReset();
    getConfigMock.mockReset();
    resourcePackAddMock.mockReset();
    shaderAddMock.mockReset();
    registerModMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    searchModsMock.mockResolvedValue({ items: [], total: 0 });
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

  it('names local resource-pack recovery issues instead of collapsing them into a failed count', async () => {
    resourcePackAddMock.mockResolvedValue({
      status: 'partial-success',
      importedFileNames: ['retro-clean.zip'],
      issues: [
        {
          fileName: 'retro-broken.zip',
          status: 'invalid-archive',
          message: 'Missing pack.mcmeta',
        },
      ],
    });

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="resourcepack" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Import local .zip' }));

    const notice = await screen.findByTestId('add-mod-page-notice');

    expect(resourcePackAddMock).toHaveBeenCalledWith('alpha');
    expect(notice.getAttribute('data-tone')).toBe('warning');
    expect(notice.textContent).toContain('Added 1 resource packs.');
    expect(notice.textContent).toContain('retro-broken.zip');
    expect(notice.textContent ?? '').not.toMatch(marketplaceFramingPattern);
  });

  it('keeps resource-pack download duplicates on-surface with named recovery and a retry-ready selection', async () => {
    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'faithful',
          title: 'Faithful 64x',
        },
      ],
      total: 1,
    });
    getModVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'faithful-1.0.0',
        name: '1.0.0',
        mcVersions: ['1.20.1'],
        loaders: [],
      },
    ]);
    installModFileMock.mockResolvedValue({
      status: 'duplicate',
      issues: [
        {
          fileName: 'faithful-64x.zip',
          status: 'duplicate',
          message: 'Already installed',
        },
      ],
    });

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="resourcepack" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add selected resource packs (1)' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add selected resource packs (1)' }));

    const notice = await screen.findByTestId('add-mod-page-notice');

    expect(installModFileMock).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'resourcepack',
      projectId: 'faithful',
      versionId: 'faithful-1.0.0',
    }));
    expect(registerModMock).not.toHaveBeenCalled();
    expect(notice.getAttribute('data-tone')).toBe('warning');
    expect(notice.textContent).toContain('Faithful 64x');
    expect(notice.textContent).toContain('Already in this modpack');
    expect(notice.textContent ?? '').not.toMatch(marketplaceFramingPattern);
    expect(screen.getByRole('button', { name: 'Add selected resource packs (1)' })).toHaveProperty('disabled', false);
  });

  it('turns unsupported shader installs into runtime-blocked recovery before any download starts', async () => {
    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'complementary',
          title: 'Complementary Reimagined',
        },
      ],
      total: 1,
    });
    getModVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'complementary-1.0.0',
        name: '1.0.0',
        mcVersions: ['1.20.1'],
        loaders: [],
      },
    ]);
    getConfigMock.mockResolvedValueOnce({
      id: 'alpha',
      name: 'Alpha Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: { type: 'fabric', version: '0.16.9' },
      },
      game: {
        useOptiFine: true,
      },
    });

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="shader" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add selected shaders (1)' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add selected shaders (1)' }));

    const notice = await screen.findByTestId('add-mod-page-notice');

    expect(installModFileMock).not.toHaveBeenCalled();
    expect(notice.getAttribute('data-tone')).toBe('error');
    expect(notice.textContent).toContain('Complementary Reimagined');
    expect(notice.textContent).toContain('blocked for the current runtime');
    expect(notice.textContent ?? '').not.toMatch(marketplaceFramingPattern);
    expect(screen.getByRole('button', { name: 'Add selected shaders (1)' })).toHaveProperty('disabled', false);
  });
});
