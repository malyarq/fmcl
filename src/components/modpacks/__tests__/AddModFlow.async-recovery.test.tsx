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
const addModMock = vi.fn();

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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
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

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: (...args: unknown[]) => getModVersionsMock(...args),
    installModFile: (...args: unknown[]) => installModFileMock(...args),
  },
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getMetadata: (...args: unknown[]) => getMetadataMock(...args),
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    addMod: (...args: unknown[]) => addModMock(...args),
  },
}));

describe('Add-mod async recovery', () => {
  beforeEach(() => {
    mockMatchMedia();

    searchModsMock.mockReset();
    getModVersionsMock.mockReset();
    installModFileMock.mockReset();
    getMetadataMock.mockReset();
    getConfigMock.mockReset();
    addModMock.mockReset();

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

  it('clears hidden selections when a new visible result set replaces the old one', async () => {
    searchModsMock.mockImplementation(({ query }: { query: string }) => {
      if (query === 'iris') {
        return Promise.resolve({
          items: [
            {
              platform: 'modrinth',
              projectId: 'iris',
              title: 'Iris',
            },
          ],
          total: 1,
        });
      }

      return Promise.resolve({
        items: [
          {
            platform: 'modrinth',
            projectId: 'sodium',
            title: 'Sodium',
          },
        ],
        total: 1,
      });
    });
    getModVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: '1.0.0',
        name: '1.0.0',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
      },
    ]);

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} />);

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
    });

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add selected (1)' })).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('Search mods...'), { target: { value: 'iris' } });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
    });

    await screen.findByText('Iris');

    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', true);
    expect(screen.queryByText('Sodium')).toBeNull();
  });

  it('locks route exits during install and keeps mixed-success recovery on the current surface', async () => {
    const onBack = vi.fn();
    const installDeferred = createDeferred<void>();

    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'sodium',
          title: 'Sodium',
        },
        {
          platform: 'modrinth',
          projectId: 'iris',
          title: 'Iris',
        },
      ],
      total: 2,
    });
    getModVersionsMock.mockImplementation(({ projectId }: { projectId: string }) =>
      Promise.resolve([
        {
          platform: 'modrinth',
          versionId: `${projectId}-1.0.0`,
          name: '1.0.0',
          mcVersions: ['1.20.1'],
          loaders: ['fabric'],
        },
      ]),
    );
    installModFileMock
      .mockImplementationOnce(() => installDeferred.promise)
      .mockResolvedValueOnce(undefined);
    addModMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('manifest write failed'));

    render(
      <AddModPage modpackId="alpha" onBack={onBack} />,
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
    });

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add selected (2)' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add selected (2)' }));

    expect(screen.getByRole('button', { name: 'Modpacks' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /Back$/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);

    await act(async () => {
      installDeferred.resolve();
      await installDeferred.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId('add-mod-page-notice')).toBeTruthy();
    });

    expect(addModMock).toHaveBeenCalledTimes(2);
    expect(addModMock).toHaveBeenNthCalledWith(1, 'alpha', {
      platform: 'modrinth',
      projectId: 'sodium',
      versionId: 'sodium-1.0.0',
    }, '/minecraft');
    expect(addModMock).toHaveBeenNthCalledWith(2, 'alpha', {
      platform: 'modrinth',
      projectId: 'iris',
      versionId: 'iris-1.0.0',
    }, '/minecraft');
    expect(screen.getByTestId('add-mod-page-notice').getAttribute('data-tone')).toBe('warning');
    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', true);
    expect(onBack).not.toHaveBeenCalled();
  });
});
