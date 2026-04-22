// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModPage } from '../AddModPage';

const searchModsMock = vi.fn();
const getMetadataMock = vi.fn();
const getConfigMock = vi.fn();

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: createTranslator('en'),
    getAccentStyles: () => ({ className: '', style: undefined }),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
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
    addMod: vi.fn(),
    resolvePath: vi.fn(),
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

describe('AddModPage flow layout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchModsMock.mockReset();
    getMetadataMock.mockReset();
    getConfigMock.mockReset();

    searchModsMock.mockResolvedValue({
      items: [
        {
          platform: 'modrinth',
          projectId: 'sodium',
          title: 'Sodium',
          description: 'Performance renderer',
        },
      ],
      total: 1,
    });
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the action rail outside the results viewport so streaming results cannot bury it', async () => {
    render(<AddModPage modpackId="alpha" onBack={vi.fn()} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(searchModsMock).toHaveBeenCalled();

    expect(screen.getByText('Sodium')).toBeTruthy();

    const pageBody = screen.getByTestId('add-mod-page-body');
    const resultsScroll = screen.getByTestId('add-mod-results-scroll');
    const results = screen.getByTestId('add-mod-results');
    const actions = screen.getByTestId('add-mod-page-actions');

    expect(resultsScroll.className).toContain('overflow-y-auto');
    expect(resultsScroll.contains(results)).toBe(true);
    expect(resultsScroll.contains(actions)).toBe(false);
    expect(pageBody.contains(actions)).toBe(true);
  });

  it('keeps guided resource-pack browsing instance-scoped without modloader filters', async () => {
    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="resourcepack" />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(searchModsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'resourcepack',
        loader: undefined,
      }),
    );
    expect(screen.getByRole('heading', { name: 'Add Resource Pack' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search resource packs...')).toBeTruthy();
    expect(screen.getByTestId('guided-content-resourcepack-scope').textContent).toContain('Resource packs added here only affect this modpack');
    expect(screen.getByTestId('guided-content-local-fallback').textContent).toContain('Have a local resource pack .zip already?');
    expect(screen.getByRole('button', { name: 'Import local .zip' })).toBeTruthy();
    expect(screen.queryByText(/all modloaders/i)).toBeNull();
  });

  it('shows honest shader runtime guidance instead of implying catalog compatibility', async () => {
    getConfigMock.mockResolvedValueOnce({
      id: 'alpha',
      name: 'Alpha Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: { type: 'forge', version: '47.2.0' },
      },
      game: {
        useOptiFine: false,
      },
    });

    render(<AddModPage modpackId="alpha" onBack={vi.fn()} contentType="shader" />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    const guidance = screen.getByTestId('guided-content-shader-capability');
    expect(guidance.getAttribute('data-status')).toBe('needs-setup');
    expect(guidance.textContent).toContain('Needs setup');
    expect(guidance.textContent).toContain('does not see shader support configured');
    expect(guidance.textContent).toContain('not compatibility guarantees');
  });

  it('does not render the local zip fallback card for the regular mod route', async () => {
    render(<AddModPage modpackId="alpha" onBack={vi.fn()} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(screen.queryByTestId('guided-content-local-fallback')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import local .zip' })).toBeNull();
  });
});
