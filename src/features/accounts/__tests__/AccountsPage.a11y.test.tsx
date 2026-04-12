// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPage } from '../AccountsPage';

const confirmMock = vi.fn();
const getAccountsMock = vi.fn();
const getSelectedAccountMock = vi.fn();
const selectAccountMock = vi.fn();

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: (...args: unknown[]) => confirmMock(...args),
  }),
}));

vi.mock('../../../services/ipc/accountIPC', () => ({
  accountIPC: {
    getAccounts: (...args: unknown[]) => getAccountsMock(...args),
    getSelectedAccount: (...args: unknown[]) => getSelectedAccountMock(...args),
    selectAccount: (...args: unknown[]) => selectAccountMock(...args),
    removeAccount: vi.fn(),
  },
}));

vi.mock('../AddAccountDialog', () => ({
  AddAccountDialog: () => null,
}));

vi.mock('../AccountSkinPanel', () => ({
  AccountSkinPanel: () => <div>Skin panel</div>,
}));

describe('AccountsPage accessibility', () => {
  beforeEach(() => {
    confirmMock.mockReset();
    getAccountsMock.mockReset();
    getSelectedAccountMock.mockReset();
    selectAccountMock.mockReset();

    const accounts = [
      {
        id: 'account-1',
        type: 'offline',
        name: 'Player One',
      },
      {
        id: 'account-2',
        type: 'third-party',
        name: 'Player Two',
        authServerUrl: 'https://littleskin.cn/api/yggdrasil',
        isDisabled: true,
        disabledReason: 'insecureRemoteHttp',
      },
    ];

    getAccountsMock.mockResolvedValue(accounts);
    getSelectedAccountMock.mockResolvedValue(accounts[0]);
    selectAccountMock.mockResolvedValue(undefined);
  });

  it('renders account cards as a labeled list with accessible selection and removal controls', async () => {
    render(<AccountsPage />);

    const list = await screen.findByRole('list', { name: 'accounts.title' });
    expect(list).toBeTruthy();

    const accountButton = (await screen.findAllByRole('button', { name: /Player One/i }))
      .find((button) => button.getAttribute('aria-pressed') === 'true');

    expect(accountButton).toBeTruthy();
    if (!accountButton) {
      throw new Error('Expected to find selected account button');
    }

    expect(accountButton.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(accountButton);

    await waitFor(() => {
      expect(selectAccountMock).toHaveBeenCalledWith('account-1');
    });

    expect(screen.getByRole('button', { name: 'accounts.removeConfirm: Player One' })).toBeTruthy();
    expect(screen.getByText('accounts.disabledBadge')).toBeTruthy();
  });
});
