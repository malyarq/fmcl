// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MirrorsSettings } from '../MirrorsSettings';

const getMirrorsMock = vi.fn();
const isAutoSelectEnabledMock = vi.fn();
const testSpeedMock = vi.fn();

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'mirrors.priorityFallback' && params?.priority) {
        return `Fallback ${params.priority}`;
      }

      return key;
    },
  }),
}));

vi.mock('../../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../../../services/ipc/mirrorsIPC', () => ({
  mirrorsIPC: {
    getMirrors: (...args: unknown[]) => getMirrorsMock(...args),
    isAutoSelectEnabled: (...args: unknown[]) => isAutoSelectEnabledMock(...args),
    setAutoSelect: vi.fn(),
    selectMirror: vi.fn(),
    moveMirror: vi.fn(),
    removeMirror: vi.fn(),
    addCustomMirror: vi.fn(),
    testSpeed: (...args: unknown[]) => testSpeedMock(...args),
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

describe('MirrorsSettings accessibility', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    getMirrorsMock.mockReset();
    isAutoSelectEnabledMock.mockReset();
    testSpeedMock.mockReset();

    getMirrorsMock.mockResolvedValue([
      {
        id: 'mirror-1',
        name: 'Primary Mirror',
        rootUrl: 'https://mirror.example.com',
        priority: 1,
        type: 'official',
        isActive: true,
        isDisabled: false,
      },
    ]);
    isAutoSelectEnabledMock.mockResolvedValue(false);
    testSpeedMock.mockResolvedValue(42);
  });

  it('renders labeled mirror controls and exposes the add-dialog semantics', async () => {
    render(<MirrorsSettings />);

    expect(await screen.findByRole('heading', { name: 'mirrors.sectionTitle' })).toBeTruthy();
    expect(await screen.findByRole('list', { name: 'mirrors.description' })).toBeTruthy();
    expect(screen.getByText('mirrors.priorityHint')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'mirrors.testSpeed: Primary Mirror' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'mirrors.autoSelect' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'mirrors.addCustom' }));

    const dialog = await screen.findByRole('dialog', { name: 'mirrors.addCustomTitle' });
    expect(dialog).toBeTruthy();
    expect(screen.getByLabelText('mirrors.name')).toBeTruthy();
    expect(screen.getByLabelText('mirrors.rootUrl')).toBeTruthy();
  });

  it('keeps the mirror speed test reachable with a descriptive button name', async () => {
    render(<MirrorsSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'mirrors.testSpeed: Primary Mirror' }));

    await waitFor(() => {
      expect(testSpeedMock).toHaveBeenCalledWith('https://mirror.example.com');
    });
  });
});
