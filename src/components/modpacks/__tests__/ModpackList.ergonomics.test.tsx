// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';
import { LAUNCHER_MARK_PATH } from '../../../app/assets/branding';

const listWithMetadataMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    modpacks: [{ id: 'alpha', name: 'Alpha Pack' }],
    selectedId: '',
    select: (...args: unknown[]) => selectMock(...args),
    remove: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    refresh: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    minecraftPath: '/minecraft',
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
    listWithMetadata: (...args: unknown[]) => listWithMetadataMock(...args),
  },
}));

vi.mock('../../../features/share/ShareModal', () => ({
  ShareModal: () => null,
}));

vi.mock('../../../features/share/ImportShareModal', () => ({
  ImportShareModal: () => null,
}));

describe('ModpackList ergonomics', () => {
  beforeEach(() => {
    cleanup();
    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: 'Alpha Pack',
        path: '/packs/alpha',
        selected: false,
        metadata: {
          description: 'Route truth test pack',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
        },
      },
    ]);
  });

  it('keeps installed catalog controls readable at sidebar widths and uses the launcher mark for no-art cards', async () => {
    render(<ModpackList />);

    await screen.findByText('Alpha Pack');

    const searchRegion = screen.getByRole('search', { name: 'Enter modpack name...' });
    const controlsRow = searchRegion.querySelector('.flex.flex-wrap.items-start.gap-2');
    const sortShell = screen.getByRole('combobox', { name: 'By name' }).parentElement?.parentElement;
    const versionShell = screen.getByRole('combobox', { name: 'All versions' }).parentElement?.parentElement;
    const loaderShell = screen.getByRole('combobox', { name: 'All Modloaders' }).parentElement?.parentElement;

    expect(controlsRow?.className).toContain('flex-wrap');
    expect(sortShell?.className).toContain('min-w-[12rem]');
    expect(sortShell?.className).toContain('flex-1');
    expect(versionShell?.className).toContain('min-w-[11rem]');
    expect(versionShell?.className).toContain('flex-1');
    expect(loaderShell?.className).toContain('min-w-[11rem]');
    expect(loaderShell?.className).toContain('flex-1');

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Alpha Pack' }).getAttribute('src')).toBe(LAUNCHER_MARK_PATH);
    });
  });
});
