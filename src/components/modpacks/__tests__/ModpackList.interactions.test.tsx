// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModpackList } from '../ModpackList';
import { createTranslator } from '../../../contexts/settings/i18n';
import modpackListSource from '../ModpackList.tsx?raw';

const listMock = vi.fn();
const metadataMock = vi.fn();
const selectMock = vi.fn();
const refreshMock = vi.fn();
const onNavigateMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const t = createTranslator('en');

let selectedIdState = '';
let modpackItemsState: Array<{
  id: string;
  name: string;
  selected: boolean;
  metadata: {
    description: string;
    minecraftVersion: string;
    modLoader: { type: 'fabric' };
  };
}> = [];

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({
    status: 'ready',
    data: modpackItemsState.map(({ id, name, selected, metadata }) => ({
      id,
      name,
      selected,
      summary: {
        minecraftVersion: metadata.minecraftVersion,
        modLoader: metadata.modLoader,
      },
    })),
  }),
  useSelectedInstanceId: () => ({ status: 'ready', data: selectedIdState }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../contexts/instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({
    select: (...args: unknown[]) => selectMock(...args),
    remove: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    duplicateOperation: null,
    duplicateOperationError: null,
    cancelDuplicate: vi.fn(),
    retryDuplicate: vi.fn(),
    deleteOperation: null,
    deleteOperationError: null,
    cancelDelete: vi.fn(),
    retryDelete: vi.fn(),
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
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
    prompt: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    list: () => listMock(),
    metadata: (...args: unknown[]) => metadataMock(...args),
  },
}));

vi.mock('../../../features/share/ShareModal', () => ({
  ShareModal: () => null,
}));

vi.mock('../../../features/share/ImportShareModal', () => ({
  ImportShareModal: ({ isOpen, onCommitted }: { isOpen: boolean; onCommitted: () => Promise<void> }) => (
    isOpen ? <button type="button" onClick={() => { void onCommitted(); }}>Commit share import</button> : null
  ),
}));

function buildModpackItem(name: string, selected = false) {
  return {
    id: 'alpha',
    name,
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

    listMock.mockReset();
    metadataMock.mockReset();
    selectMock.mockReset();
    refreshMock.mockReset();
    onNavigateMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();

    selectMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    listMock.mockImplementation(async () => ({
      ok: true,
      value: {
        status: 'ready',
        instances: modpackItemsState.map(({ id, name, selected, metadata }) => ({
          id,
          name,
          selected,
          summary: {
            minecraftVersion: metadata.minecraftVersion,
            modLoader: metadata.modLoader,
          },
        })),
      },
    }));
    metadataMock.mockImplementation(async ({ id }: { id: string }) => ({
      ok: true,
      value: {
        source: 'local',
        description: modpackItemsState.find((item) => item.id === id)?.metadata.description,
        createdAt: '2026-04-20T00:00:00.000Z',
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
    }));
  });

  it('uses a native button for card activation and selects the modpack once', async () => {
    renderList();

    const cardButton = await screen.findByRole('button', { name: 'Alpha Pack' });
    expect(cardButton.tagName).toBe('BUTTON');
    fireEvent.click(cardButton);

    await waitFor(() => {
      expect(selectMock).toHaveBeenCalledTimes(1);
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

  it('closes the keyboard menu with Escape and restores focus to its card activator', async () => {
    renderList();

    const cardActivator = await screen.findByRole('button', { name: 'Alpha Pack' });
    cardActivator.focus();
    fireEvent.keyDown(cardActivator, { key: 'ContextMenu', code: 'ContextMenu' });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Open details' })).toBe(document.activeElement);
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(document.getElementById('modpack-actions-menu-alpha')).toBeNull();
      expect(document.activeElement).toBe(cardActivator);
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

  it('invalidates canonical instances after share publication without page-local completion effects', async () => {
    renderList();
    fireEvent.click(await screen.findByRole('button', { name: 'Import from Code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Commit share import' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(toastSuccessMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('owns no operation subscription or reload fallback in the list surface', () => {
    expect(modpackListSource).not.toMatch(/operationsIPC|\.subscribe\s*\(|location\.reload|window\.location/);
  });
});
