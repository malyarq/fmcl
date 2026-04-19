// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModModal } from '../AddModModal';
import { AddModPage } from '../AddModPage';

const searchModsMock = vi.fn();
const getModVersionsMock = vi.fn();
const getMetadataMock = vi.fn();
const getConfigMock = vi.fn();
const t = createTranslator('en');

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

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getMetadata: (...args: unknown[]) => getMetadataMock(...args),
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    addMod: vi.fn(),
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

    expect(await screen.findByText('1.2.0 (1.20.1)')).toBeTruthy();
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
});
