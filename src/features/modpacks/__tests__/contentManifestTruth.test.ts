// @vitest-environment jsdom

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModPage } from '../../../components/modpacks/AddModPage';

const searchModsMock = vi.fn();
const getModVersionsMock = vi.fn();
const installModFileMock = vi.fn();
const getMetadataMock = vi.fn();
const getConfigMock = vi.fn();
const registerModMock = vi.fn();
const invalidateInstanceMock = vi.fn();

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

async function flushSearchDebounce() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 550));
  });
}

async function selectFirstCatalogResult(expectedActionLabel: string) {
  fireEvent.click(screen.getByRole('checkbox'));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: expectedActionLabel })).toBeTruthy();
  });

  if (expectedActionLabel !== 'Add selected (1)') {
    expect(screen.queryByRole('button', { name: 'Add selected (1)' })).toBeNull();
  }
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
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../instances/hooks/useInstanceSelectors', () => ({
  useInstanceSnapshot: () => ({
    status: 'ready',
    data: {
      id: 'alpha',
      name: 'Alpha Pack',
      runtime: { minecraft: '1.20.1', modLoader: { type: 'fabric' } },
    },
  }),
}));

vi.mock('../../instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: invalidateInstanceMock,
    invalidateInstances: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: (...args: unknown[]) => getModVersionsMock(...args),
    installModFile: (...args: unknown[]) => installModFileMock(...args),
  },
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

describe('guided content manifest truth', () => {
  beforeEach(() => {
    mockMatchMedia();

    searchModsMock.mockReset();
    getModVersionsMock.mockReset();
    installModFileMock.mockReset();
    getMetadataMock.mockReset();
    getConfigMock.mockReset();
    registerModMock.mockReset();
    invalidateInstanceMock.mockReset();
    invalidateInstanceMock.mockResolvedValue(undefined);

    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'fancy-content',
          title: 'Fancy Content',
        },
      ],
      total: 1,
    });
    getModVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'fancy-content-1.0.0',
        name: '1.0.0',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
      },
    ]);
    installModFileMock.mockResolvedValue({ status: 'success', issues: [] });
    registerModMock.mockResolvedValue({ ok: true });
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

  it.each(['resourcepack', 'shader'] as const)(
    'keeps %s installs instance-scoped instead of writing fake manifest dependencies',
    async (contentType) => {
      const onBack = vi.fn();

      render(React.createElement(AddModPage, { modpackId: 'alpha', onBack, contentType }));

      await flushSearchDebounce();
      await selectFirstCatalogResult(
        contentType === 'resourcepack' ? 'Add selected resource packs (1)' : 'Add selected shaders (1)',
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: contentType === 'resourcepack' ? 'Add selected resource packs (1)' : 'Add selected shaders (1)',
        }),
      );

      expect(installModFileMock).toHaveBeenCalledWith(expect.objectContaining({
        contentType,
        instanceId: 'alpha',
      }));
      expect(installModFileMock).toHaveBeenCalledTimes(1);
      expect(registerModMock).not.toHaveBeenCalled();
    },
  );

  it('still finalizes real mods into manifest.files after the download succeeds', async () => {
    const onBack = vi.fn();

    render(React.createElement(AddModPage, { modpackId: 'alpha', onBack }));

    await flushSearchDebounce();
    await selectFirstCatalogResult('Add selected (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Add selected (1)' }));

    await waitFor(() => {
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    expect(registerModMock).toHaveBeenCalledTimes(1);
    expect(registerModMock).toHaveBeenCalledWith('alpha', {
      platform: 'modrinth',
      projectId: 'fancy-content',
      versionId: 'fancy-content-1.0.0',
    });
  });
});
