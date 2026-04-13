// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Screenshot } from '../../../../../electron/services/screenshots/screenshotService';
import { ScreenshotsTab } from '../ScreenshotsTab';
import { ScreenshotLightbox } from '../ScreenshotLightbox';
import { createTranslator } from '../../../../contexts/settings/i18n';

const listMock = vi.fn();
const deleteMock = vi.fn();
const renameMock = vi.fn();
const openFolderMock = vi.fn();
const confirmMock = vi.fn();
const promptMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const clipboardWriteMock = vi.fn();
const fetchMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: (...args: unknown[]) => confirmMock(...args),
    prompt: (...args: unknown[]) => promptMock(...args),
  }),
}));

vi.mock('../../../../services/ipc/screenshotsIPC', () => ({
  screenshotsIPC: {
    list: (...args: unknown[]) => listMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    rename: (...args: unknown[]) => renameMock(...args),
    openFolder: (...args: unknown[]) => openFolderMock(...args),
  },
}));

const screenshots: Screenshot[] = [
  {
    name: 'first.png',
    path: '/instance/screenshots/first.png',
    url: 'file:///instance/screenshots/first.png',
    createdAt: 1_776_000_000_000,
    size: 1024,
  },
  {
    name: 'second.png',
    path: '/instance/screenshots/second.png',
    url: 'file:///instance/screenshots/second.png',
    createdAt: 1_776_000_100_000,
    size: 2048,
  },
];

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
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

describe('screenshots experience', () => {
  beforeEach(() => {
    cleanup();
    mockMatchMedia(false);
    listMock.mockReset();
    deleteMock.mockReset();
    renameMock.mockReset();
    openFolderMock.mockReset();
    confirmMock.mockReset();
    promptMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    clipboardWriteMock.mockReset();
    fetchMock.mockReset();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        write: (...args: unknown[]) => clipboardWriteMock(...args),
      },
    });

    class ClipboardItemMock {
      items: Record<string, Blob>;

      constructor(items: Record<string, Blob>) {
        this.items = items;
      }
    }

    Object.defineProperty(window, 'ClipboardItem', {
      configurable: true,
      value: ClipboardItemMock,
    });

    vi.stubGlobal('fetch', fetchMock);

    openFolderMock.mockResolvedValue({ ok: true });
    deleteMock.mockResolvedValue({ ok: true });
    renameMock.mockResolvedValue({ ok: true });
    confirmMock.mockResolvedValue(true);
    promptMock.mockResolvedValue('second-renamed.png');
    fetchMock.mockResolvedValue({
      blob: async () => new Blob(['png-data'], { type: 'image/png' }),
    });
  });

  it('renders the empty screenshot state with a shared open-folder action', async () => {
    listMock.mockResolvedValue([]);

    render(<ScreenshotsTab instancePath="/instance" />);

    expect(await screen.findByRole('heading', { name: 'No screenshots yet' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }));

    await waitFor(() => {
      expect(openFolderMock).toHaveBeenCalledWith('/instance');
    });
  });

  it('confirms screenshot deletion through the shared confirm flow and updates the gallery', async () => {
    listMock.mockResolvedValue([screenshots[0]]);

    render(<ScreenshotsTab instancePath="/instance" />);

    expect(await screen.findByRole('button', { name: 'Open screenshot: first.png' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete screenshot: first.png' }));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Delete screenshot',
      }));
    });

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('first.png', '/instance');
    });

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Screenshot deleted.');
    });
  });

  it('keeps the lightbox keyboard-navigable and routes rename and copy through explicit actions', async () => {
    const onRenameMock = vi.fn();

    render(
      <ScreenshotLightbox
        screenshots={screenshots}
        initialIndex={0}
        instancePath="/instance"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onOpenFolder={vi.fn()}
        onRename={onRenameMock}
      />
    );

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('first.png')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('second.png')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => {
      expect(promptMock).toHaveBeenCalledWith(expect.objectContaining({
        input: expect.objectContaining({
          initialValue: 'second.png',
        }),
      }));
    });

    await waitFor(() => {
      expect(renameMock).toHaveBeenCalledWith('second.png', 'second-renamed.png', '/instance');
    });

    expect(onRenameMock).toHaveBeenCalledWith(expect.objectContaining({ name: 'second.png' }), 'second-renamed.png');

    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('file:///instance/screenshots/second.png');
    });

    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalledTimes(1);
    });
  });
});
