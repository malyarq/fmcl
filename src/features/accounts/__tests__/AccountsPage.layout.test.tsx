// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountsPage } from '../AccountsPage';

const getAccountsMock = vi.fn();
const getSelectedAccountMock = vi.fn();

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) =>
      ({
        'accounts.title': 'Accounts',
        'accounts.description': 'Manage your Minecraft accounts and switch between them.',
        'accounts.addAccount': 'Add Account',
        'accounts.active': 'Active',
        'accounts.savedCountLabel': 'Saved accounts',
        'accounts.activeAccount': 'Current account',
        'accounts.typeOffline': 'Offline',
        'accounts.providerSupportHint': 'Blessing Skin and LittleSkin are supported for provider-aware skin management.',
      }[key] ?? key),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/accountIPC', () => ({
  accountIPC: {
    getAccounts: (...args: unknown[]) => getAccountsMock(...args),
    getSelectedAccount: (...args: unknown[]) => getSelectedAccountMock(...args),
    selectAccount: vi.fn(),
    removeAccount: vi.fn(),
  },
}));

vi.mock('../AddAccountDialog', () => ({
  AddAccountDialog: () => null,
}));

vi.mock('../AccountSkinPanel', () => ({
  AccountSkinPanel: () => <div>Skin panel</div>,
}));

describe('AccountsPage layout', () => {
  beforeEach(() => {
    getAccountsMock.mockReset();
    getSelectedAccountMock.mockReset();

    const account = {
      id: 'account-1',
      type: 'offline',
      name: 'Player One',
    };

    getAccountsMock.mockResolvedValue([account]);
    getSelectedAccountMock.mockResolvedValue(account);
  });

  it('removes the standalone accounts hero when embedded inside SettingsPage', async () => {
    render(<AccountsPage embedded />);

    expect(screen.queryByRole('heading', { name: 'Accounts' })).toBeNull();
    expect((await screen.findAllByText('Saved accounts')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add Account' })).toBeTruthy();
    expect(screen.getByText('Current account')).toBeTruthy();
  });
});
