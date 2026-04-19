// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';

const listWithMetadataMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const onNavigateMock = vi.fn();
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
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
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

describe('ModpackList action truth', () => {
  const denseName = 'Alpha Pack With Dense Menu State';

  beforeEach(() => {
    cleanup();
    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();
    onNavigateMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: denseName,
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

  it('routes the contextual details action to the details screen and does not expose a fake play action', async () => {
    render(<ModpackList onNavigate={onNavigateMock} />);

    const actionButton = await screen.findByRole('button', { name: `More actions: ${denseName}` });
    fireEvent.click(actionButton);

    expect(await screen.findByRole('menu', { name: `More actions: ${denseName}` })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Play' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Open details' }));

    await waitFor(() => {
      expect(onNavigateMock).toHaveBeenCalledWith({ type: 'details', modpackId: 'alpha' });
    });
  });

  it('opens the action menu from the keyboard and focuses the first menu item', async () => {
    render(<ModpackList onNavigate={onNavigateMock} />);

    const cardActivator = await screen.findByRole('button', { name: denseName });
    Object.defineProperty(cardActivator, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 96,
        left: 220,
        right: 260,
        bottom: 128,
        width: 40,
        height: 32,
      }),
    });

    fireEvent.keyDown(cardActivator, { key: 'ContextMenu' });

    const menu = await screen.findByRole('menu', { name: `More actions: ${denseName}` });
    expect(menu).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Open details' })).toBe(document.activeElement);
    });
  });
});
