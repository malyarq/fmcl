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
  },
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

  it('uses the route scroll container instead of a fixed-height results scroller', async () => {
    render(<AddModPage modpackId="alpha" onBack={vi.fn()} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(searchModsMock).toHaveBeenCalled();

    expect(screen.getByText('Sodium')).toBeTruthy();

    const scrollContainer = screen.getByTestId('add-mod-page-scroll');
    const results = screen.getByTestId('add-mod-results');
    const actions = screen.getByTestId('add-mod-page-actions');

    expect(scrollContainer.className).toContain('overflow-y-auto');
    expect(results.className).not.toContain('max-h-96');
    expect(results.className).not.toContain('overflow-y-auto');
    expect(scrollContainer.contains(actions)).toBe(true);
  });
});
