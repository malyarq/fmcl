// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { ShadersTab } from '../ShadersTab';

const listMock = vi.fn();
const toastErrorMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
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

vi.mock('../../../../services/ipc/shadersIPC', () => ({
  shadersIPC: {
    list: (...args: unknown[]) => listMock(...args),
    setActive: vi.fn(),
    disable: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('ShadersTab degraded states', () => {
  beforeEach(() => {
    cleanup();
    listMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('shows an unavailable state when shader packs fail to load', async () => {
    listMock.mockRejectedValue(new Error('[IPC] shaders failed: Shader folder unavailable'));

    render(<ShadersTab instancePath="/instances/alpha" />);

    const errorState = await screen.findByRole('status');
    expect(screen.getByRole('heading', { name: t('modpacks.shader_load_error') })).toBeTruthy();
    expect(errorState.textContent).toContain(t('degraded.unavailable_label'));
    expect(errorState.textContent).not.toContain(t('modpacks.no_shaders_installed'));
    expect(within(errorState).getByRole('button', { name: t('modpacks.update') })).toBeTruthy();
  });
});
