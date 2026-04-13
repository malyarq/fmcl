// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';

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

describe('ModpackList keyboard accessibility', () => {
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
          description: 'Keyboard friendly pack',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
        },
      },
    ]);
  });

  it('allows selecting a modpack card from the keyboard', async () => {
    render(<ModpackList />);

    const cardButton = await screen.findByRole('button', { name: 'Alpha Pack' });
    fireEvent.keyDown(cardButton, { key: 'Enter' });

    await waitFor(() => {
      expect(selectMock).toHaveBeenCalledWith('alpha');
    });
  });

  it('opens the action menu from the keyboard with labeled menu semantics', async () => {
    render(<ModpackList />);

    const cardButton = await screen.findByRole('button', { name: 'Alpha Pack' });
    fireEvent.keyDown(cardButton, { key: 'F10', shiftKey: true });

    const menu = await screen.findByRole('menu', { name: 'More actions: Alpha Pack' });
    expect(menu).toBeTruthy();
    expect(screen.getByRole('button', { name: 'More actions: Alpha Pack' }).getAttribute('aria-expanded')).toBe('true');

    await waitFor(() => {
      expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    });
  });
});
