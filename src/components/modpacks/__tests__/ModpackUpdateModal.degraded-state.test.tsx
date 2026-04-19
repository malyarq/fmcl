// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackUpdateModal } from '../ModpackUpdateModal';

const getModrinthVersionsMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getModrinthVersions: (...args: unknown[]) => getModrinthVersionsMock(...args),
    getCurseForgeVersions: (...args: unknown[]) => getCurseForgeVersionsMock(...args),
    backup: vi.fn(),
    installModrinth: vi.fn(),
    installCurseForge: vi.fn(),
  },
}));

function mockWindowApi() {
  Object.defineProperty(window, 'api', {
    writable: true,
    value: {
      ipcRenderer: {
        on: vi.fn(),
        off: vi.fn(),
      },
    },
  });
}

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

describe('ModpackUpdateModal degraded states', () => {
  beforeEach(() => {
    getModrinthVersionsMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    mockWindowApi();
    mockMatchMedia();
  });

  it('shows a dedicated degraded error instead of treating failed version loading as no updates', async () => {
    getModrinthVersionsMock.mockRejectedValue(new Error('[modpacksIPC] getModrinthVersions failed: ${file.jarVersion}'));

    render(
      <ModpackUpdateModal
        modpackId="alpha"
        sourceId="alpha-pack"
        source="modrinth"
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Unable to load updates' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Needs attention');
    expect(screen.queryByText('No updates available')).toBeNull();
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull();
  });

  it('sanitizes suspicious version and changelog placeholders before rendering them', async () => {
    getModrinthVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'release-2',
        name: '${file.jarVersion}',
        versionNumber: '1.2.0',
        changelog: '${file.jarVersion}',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
        files: [],
      },
    ]);

    render(
      <ModpackUpdateModal
        modpackId="alpha"
        sourceId="alpha-pack"
        source="modrinth"
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('option', { name: '1.2.0 (1.20.1)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Changelog unavailable' })).toBeTruthy();
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull();
  });
});
