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
    t: (key: string) =>
      ({
        'accounts.title': 'Accounts',
        'accounts.description': 'Manage your Minecraft accounts and switch between them.',
        'accounts.addAccount': 'Add Account',
        'accounts.active': 'Active',
        'accounts.disabledBadge': 'Disabled',
        'accounts.disabledInsecureAuthServer': 'This saved account was disabled because its auth server uses insecure remote HTTP.',
        'accounts.disabledRecovery': 'Remove it and add it again with an HTTPS server URL or a local loopback URL.',
        'accounts.disabledSecureStorage': 'This account is disabled because secure credential storage is unavailable on this system.',
        'accounts.disabledSecureStorageRecovery': 'Enable the operating-system keyring, restart Burrow, then add the account again.',
        'accounts.disabledReauthentication': 'This account no longer has valid saved credentials.',
        'accounts.disabledReauthenticationRecovery': 'Remove it and sign in again to restore encrypted credentials.',
        'accounts.typeOffline': 'Offline',
        'accounts.typeThirdParty': 'Third Party',
        'accounts.removeConfirm': 'Remove',
        'accounts.loadError': 'Failed to load accounts.',
        'accounts.selectError': 'Failed to select account.',
        'accounts.providerSupportHint': 'Blessing Skin and LittleSkin are supported for provider-aware skin management.',
        'common.remove': 'Remove',
      }[key] ?? key),
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

    const list = await screen.findByRole('list', { name: 'Accounts' });
    expect(list).toBeTruthy();

    expect(screen.getByText('Blessing Skin and LittleSkin are supported for provider-aware skin management.')).toBeTruthy();

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

    expect(screen.getByRole('button', { name: 'Remove: Player One' })).toBeTruthy();
    expect(screen.getByText('Disabled')).toBeTruthy();
  });
});
