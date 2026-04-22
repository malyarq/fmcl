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

let selectedIdState = '';
let modpackItemsState: Array<{
  id: string;
  name: string;
  path: string;
  selected: boolean;
  metadata: {
    description: string;
    minecraftVersion: string;
    modLoader: { type: 'fabric' };
  };
}> = [];

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    modpacks: modpackItemsState.map(({ id, name }) => ({ id, name })),
    selectedId: selectedIdState,
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

function buildModpackItem(name: string, selected = false) {
  return {
    id: 'alpha',
    name,
    path: '/packs/alpha',
    selected,
    metadata: {
      description: 'Interaction test pack',
      minecraftVersion: '1.20.1',
      modLoader: { type: 'fabric' as const },
    },
  };
}

function renderList() {
  return render(<ModpackList onNavigate={onNavigateMock} />);
}

describe('ModpackList interactions', () => {
  beforeEach(() => {
    cleanup();
    selectedIdState = '';
    modpackItemsState = [buildModpackItem('Alpha Pack')];

    listWithMetadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();
    onNavigateMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    listWithMetadataMock.mockImplementation(async () => modpackItemsState);
  });

  it('allows selecting a modpack card from the keyboard', async () => {
    renderList();

    const cardButton = await screen.findByRole('button', { name: 'Alpha Pack' });
    fireEvent.keyDown(cardButton, { key: 'Enter' });

    await waitFor(() => {
      expect(selectMock).toHaveBeenCalledWith('alpha');
    });
  });

  it('opens the action menu from the keyboard with labeled menu semantics', async () => {
    renderList();

    const cardButton = await screen.findByRole('button', { name: 'Alpha Pack' });
    Object.defineProperty(cardButton, 'getBoundingClientRect', {
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

    cardButton.focus();
    fireEvent.keyDown(cardButton, { key: 'ContextMenu', code: 'ContextMenu' });

    const actionButton = screen.getByRole('button', { name: 'More actions: Alpha Pack' });

    await waitFor(() => {
      expect(actionButton.getAttribute('aria-expanded')).toBe('true');
    });

    const menu = document.getElementById('modpack-actions-menu-alpha');
    expect(menu?.getAttribute('role')).toBe('menu');
    expect(menu?.getAttribute('aria-label')).toBe('More actions: Alpha Pack');

    await waitFor(() => {
      expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    });
  });

  it('routes the contextual details action to the details screen and does not expose a fake play action', async () => {
    modpackItemsState = [buildModpackItem('Alpha Pack With Dense Menu State')];
    renderList();

    const actionButton = await screen.findByRole('button', { name: 'More actions: Alpha Pack With Dense Menu State' });
    fireEvent.click(actionButton);

    expect(document.getElementById('modpack-actions-menu-alpha')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Play' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Open details' }));

    await waitFor(() => {
      expect(onNavigateMock).toHaveBeenCalledWith({ type: 'details', modpackId: 'alpha' });
    });
  });

  it('opens the action menu from the keyboard and focuses the first menu item', async () => {
    modpackItemsState = [buildModpackItem('Alpha Pack With Dense Menu State')];
    renderList();

    const cardActivator = await screen.findByRole('button', { name: 'Alpha Pack With Dense Menu State' });
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

    fireEvent.keyDown(cardActivator, { key: 'ContextMenu', code: 'ContextMenu' });

    const actionButton = screen.getByRole('button', { name: 'More actions: Alpha Pack With Dense Menu State' });

    await waitFor(() => {
      expect(actionButton.getAttribute('aria-expanded')).toBe('true');
    });

    const menu = document.getElementById('modpack-actions-menu-alpha');
    expect(menu?.getAttribute('role')).toBe('menu');
    expect(menu?.getAttribute('aria-label')).toBe('More actions: Alpha Pack With Dense Menu State');

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Open details' })).toBe(document.activeElement);
    });
  });

  it('prioritizes opening details while keeping activation as a fast secondary action', async () => {
    modpackItemsState = [buildModpackItem('Alpha Pack With Dense Action Footer')];
    renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Open details: Alpha Pack With Dense Action Footer' }));

    await waitFor(() => {
      expect(onNavigateMock).toHaveBeenCalledWith({ type: 'details', modpackId: 'alpha' });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Make active: Alpha Pack With Dense Action Footer' }));

    await waitFor(() => {
      expect(selectMock).toHaveBeenCalledWith('alpha');
    });
  });

  it('keeps the primary manage action visible even when the card is already active', async () => {
    selectedIdState = 'alpha';
    modpackItemsState = [buildModpackItem('Alpha Pack With Dense Action Footer', true)];
    renderList();

    expect(await screen.findByRole('button', { name: 'Open details: Alpha Pack With Dense Action Footer' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Active now: Alpha Pack With Dense Action Footer' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
