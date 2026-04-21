// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModPage } from '../AddModPage';

const searchModsMock = vi.fn();
const getMetadataMock = vi.fn();
const getConfigMock = vi.fn();
const resolvePathMock = vi.fn();
const addModMock = vi.fn();
const resourcePackAddMock = vi.fn();
const shaderAddMock = vi.fn();
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
    getModVersions: vi.fn(),
    installModFile: vi.fn(),
  },
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getMetadata: (...args: unknown[]) => getMetadataMock(...args),
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    resolvePath: (...args: unknown[]) => resolvePathMock(...args),
    addMod: (...args: unknown[]) => addModMock(...args),
  },
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

describe('guided content fallback', () => {
  beforeEach(() => {
    mockMatchMedia();

    searchModsMock.mockReset();
    getMetadataMock.mockReset();
    getConfigMock.mockReset();
    resolvePathMock.mockReset();
    addModMock.mockReset();
    resourcePackAddMock.mockReset();
    shaderAddMock.mockReset();
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
    resolvePathMock.mockResolvedValue('/instances/alpha');
  });

  it('keeps resource-pack local import inside the guided route and scoped to the resolved instance', async () => {
    const onBack = vi.fn();
    resourcePackAddMock.mockResolvedValue({
      status: 'success',
      importedFileNames: ['retro.zip'],
      issues: [],
    });

    render(<AddModPage modpackId="alpha" onBack={onBack} contentType="resourcepack" />);

    expect(screen.getByTestId('guided-content-local-fallback').textContent).toContain('Have a local resource pack .zip already?');
    expect(document.body.textContent ?? '').not.toMatch(marketplaceFramingPattern);

    fireEvent.click(screen.getByRole('button', { name: 'Import local .zip' }));

    await waitFor(() => {
      expect(resolvePathMock).toHaveBeenCalledWith('alpha', '/minecraft');
    });

    expect(resourcePackAddMock).toHaveBeenCalledWith('/instances/alpha');
    expect(shaderAddMock).not.toHaveBeenCalled();
    expect(addModMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Resource packs added to this modpack.');
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps shader fallback on-surface with explicit recovery when the local archive is invalid', async () => {
    const onBack = vi.fn();
    shaderAddMock.mockResolvedValue({
      status: 'invalid-archive',
      importedFileNames: [],
      issues: [
        {
          fileName: 'bad-shader.zip',
          status: 'invalid-archive',
          message: 'The selected archive does not contain a shaders/ directory.',
        },
      ],
    });

    render(<AddModPage modpackId="alpha" onBack={onBack} contentType="shader" />);

    expect(screen.getByTestId('guided-content-local-fallback').textContent).toContain('Have a local shader pack .zip already?');
    expect(document.body.textContent ?? '').not.toMatch(marketplaceFramingPattern);

    fireEvent.click(screen.getByRole('button', { name: 'Import local .zip' }));

    const notice = await screen.findByTestId('add-mod-page-notice');

    expect(resolvePathMock).toHaveBeenCalledWith('alpha', '/minecraft');
    expect(shaderAddMock).toHaveBeenCalledWith('/instances/alpha');
    expect(resourcePackAddMock).not.toHaveBeenCalled();
    expect(notice.getAttribute('data-tone')).toBe('error');
    expect(notice.textContent).toContain('FMCL could not treat these files as valid shader packs');
    expect(notice.textContent).toContain('bad-shader.zip');
    expect(onBack).not.toHaveBeenCalled();
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(addModMock).not.toHaveBeenCalled();
  });
});
