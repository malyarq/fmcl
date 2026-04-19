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

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    modpacks: [{ id: 'alpha', name: 'Alpha Pack' }],
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

describe('ModpackList quick actions', () => {
  const denseName = 'Alpha Pack With Dense Action Footer';

  beforeEach(() => {
    cleanup();
    selectedIdState = '';
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
        selected: selectedIdState === 'alpha',
        metadata: {
          description: 'Quick action pack',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
        },
      },
    ]);
  });

  it('prioritizes opening details while keeping activation as a fast secondary action', async () => {
    render(<ModpackList onNavigate={onNavigateMock} />);

    fireEvent.click(await screen.findByRole('button', { name: `Open details: ${denseName}` }));

    await waitFor(() => {
      expect(onNavigateMock).toHaveBeenCalledWith({ type: 'details', modpackId: 'alpha' });
    });

    fireEvent.click(screen.getByRole('button', { name: `Make active: ${denseName}` }));

    await waitFor(() => {
      expect(selectMock).toHaveBeenCalledWith('alpha');
    });
  });

  it('keeps the primary manage action visible even when the card is already active', async () => {
    selectedIdState = 'alpha';
    listWithMetadataMock.mockResolvedValue([
      {
        id: 'alpha',
        name: denseName,
        path: '/packs/alpha',
        selected: true,
        metadata: {
          description: 'Quick action pack',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
        },
      },
    ]);

    render(<ModpackList onNavigate={onNavigateMock} />);

    expect(await screen.findByRole('button', { name: `Open details: ${denseName}` })).toBeTruthy();
    expect((screen.getByRole('button', { name: `Active now: ${denseName}` }) as HTMLButtonElement).disabled).toBe(true);
  });
});
