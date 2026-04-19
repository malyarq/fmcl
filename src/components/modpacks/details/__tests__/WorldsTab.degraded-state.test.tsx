// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { WorldsTab } from '../WorldsTab';

const listMock = vi.fn();
const toastErrorMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    formatDate: (timestamp: number | undefined, unknownText = 'Unknown', options?: Intl.DateTimeFormatOptions) =>
      timestamp ? new Date(timestamp).toLocaleDateString('en-US', options) : unknownText,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
  }),
}));

vi.mock('../../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: (...args: unknown[]) => toastErrorMock(...args),
  }),
}));

vi.mock('../../../../services/ipc/worldsIPC', () => ({
  worldsIPC: {
    list: (...args: unknown[]) => listMock(...args),
    backup: vi.fn(),
    duplicate: vi.fn(),
    delete: vi.fn(),
  },
  openWorldFolder: vi.fn(),
}));

describe('WorldsTab degraded states', () => {
  beforeEach(() => {
    cleanup();
    listMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('shows an unavailable state when saved worlds cannot be loaded', async () => {
    listMock.mockRejectedValue(new Error('[IPC] worlds failed: Saves path unavailable'));

    render(<WorldsTab instancePath="/instances/alpha" mcVersion="1.20.1" />);

    const errorState = await screen.findByRole('status');
    expect(screen.getByRole('heading', { name: t('modpacks.world_load_error') })).toBeTruthy();
    expect(errorState.textContent).toContain(t('degraded.unavailable_label'));
    expect(errorState.textContent).not.toContain(t('modpacks.no_worlds_found'));
    expect(within(errorState).getByRole('button', { name: t('modpacks.world_refresh') })).toBeTruthy();
  });
});
