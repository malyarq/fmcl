// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareModal } from '../ShareModal';
import { ImportShareModal } from '../ImportShareModal';
import { createTranslator } from '../../../contexts/settings/i18n';

const generateCodeMock = vi.fn();
const toastErrorMock = vi.fn();
const writeTextMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    success: vi.fn(),
    error: (...args: unknown[]) => toastErrorMock(...args),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

const startMock = vi.fn();
vi.mock('../../../services/ipc/shareIPC', () => ({
  shareIPC: {
    generateCode: (...args: unknown[]) => generateCodeMock(...args),
  },
}));

vi.mock('../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: (...args: unknown[]) => startMock(...args),
  },
}));

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

describe('share flows', () => {
  beforeEach(() => {
    cleanup();
    mockMatchMedia(false);
    generateCodeMock.mockReset();
    startMock.mockReset();
    toastErrorMock.mockReset();
    writeTextMock.mockReset();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (...args: unknown[]) => writeTextMock(...args),
      },
    });
  });

  it('loads a share code into the shared dialog surface and copies it to the clipboard', async () => {
    generateCodeMock.mockResolvedValue('fmcl://share/alpha-pack');

    render(<ShareModal isOpen={true} onClose={vi.fn()} modpackId="alpha-pack" />);

    expect(await screen.findByRole('dialog', { name: 'Share Modpack' })).toBeTruthy();
    expect(await screen.findByDisplayValue('fmcl://share/alpha-pack')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy Code' }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('fmcl://share/alpha-pack');
    });

    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeTruthy();
  });

  it('surfaces share-generation failures inline instead of falling back to browser errors', async () => {
    generateCodeMock.mockRejectedValue(new Error('[shareIPC] generateCode failed: ${file.jarVersion}'));

    render(<ShareModal isOpen={true} onClose={vi.fn()} modpackId="broken-pack" />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Failed to generate a share code.');
    expect(alert.textContent).not.toContain('generateCode failed');
    expect(alert.textContent).not.toContain('${file.jarVersion}');
  });

  it('keeps import disabled until a code is provided and forwards only the share code to the operation owner', async () => {
    const onImportMock = vi.fn().mockResolvedValue(undefined);

    render(<ImportShareModal isOpen={true} onClose={vi.fn()} onImport={onImportMock} />);

    const importButton = screen.getByRole('button', { name: 'Import' });
    expect(importButton.getAttribute('disabled')).not.toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Paste fmcl://share/... code here' }), {
      target: { value: 'fmcl://share/alpha-pack' },
    });

    expect(screen.getByRole('button', { name: 'Import' }).getAttribute('disabled')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => {
      expect(onImportMock).toHaveBeenCalledWith('fmcl://share/alpha-pack');
    });

    await waitFor(() => {
      expect(onImportMock).toHaveBeenCalledTimes(1);
    });
  });

  it('sanitizes import wrapper failures before showing them inline', async () => {
    const onImportMock = vi.fn().mockResolvedValue(undefined);
    onImportMock.mockRejectedValue(new Error('[operationsIPC] start failed: ${file.jarVersion}'));

    render(<ImportShareModal isOpen={true} onClose={vi.fn()} onImport={onImportMock} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Paste fmcl://share/... code here' }), {
      target: { value: 'fmcl://share/broken-pack' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Failed to import the modpack. The code may be invalid or incomplete.');
    expect(alert.textContent).not.toContain('start failed');
    expect(alert.textContent).not.toContain('${file.jarVersion}');
  });
});
