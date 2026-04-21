// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MirrorsSettings } from '../MirrorsSettings';

const getMirrorsMock = vi.fn();
const isAutoSelectEnabledMock = vi.fn();

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
    testSpeed: vi.fn(),
  },
}));

describe('MirrorsSettings layout', () => {
  beforeEach(() => {
    getMirrorsMock.mockReset();
    isAutoSelectEnabledMock.mockReset();

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
  });

  it('drops the standalone mirrors hero when embedded inside Downloads', async () => {
    render(<MirrorsSettings embedded />);

    expect(screen.queryByRole('heading', { name: 'mirrors.sectionTitle' })).toBeNull();
    expect(await screen.findByRole('switch', { name: 'mirrors.autoSelect' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'mirrors.description' })).toBeTruthy();
  });
});
