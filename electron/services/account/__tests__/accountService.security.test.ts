import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  encryptionAvailable: true,
}));

vi.mock('electron', () => ({
  net: {
    fetch: async () => ({ status: 204 }),
  },
  safeStorage: {
    isEncryptionAvailable: () => mocked.encryptionAvailable,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''),
  },
}));

import { AccountService } from '../accountService';

describe('AccountService secret boundaries', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    mocked.encryptionAvailable = true;
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('migrates plaintext tokens to encrypted persistence and never returns them to the renderer DTO', () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-account-'));
    tempDirs.push(userDataPath);
    fs.writeFileSync(path.join(userDataPath, 'accounts.json'), JSON.stringify({
      accounts: [{
        id: 'profile-1',
        type: 'third-party',
        name: 'PlayerOne',
        authServerUrl: 'https://skin.example.com/api/yggdrasil',
        accessToken: 'plain-access-token',
        clientToken: 'plain-client-token',
      }],
      selectedAccountId: 'profile-1',
    }));

    const service = new AccountService(userDataPath);
    const publicAccount = service.getSelectedAccount();
    const persisted = fs.readFileSync(path.join(userDataPath, 'accounts.json'), 'utf8');

    expect(publicAccount).not.toHaveProperty('accessToken');
    expect(publicAccount).not.toHaveProperty('clientToken');
    expect(JSON.stringify(service.getAccounts())).not.toContain('plain-access-token');
    expect(persisted).not.toContain('plain-access-token');
    expect(persisted).not.toContain('plain-client-token');
    expect(persisted).toContain('encryptedAccessToken');
    expect(persisted).toContain('encryptedClientToken');
    expect(fs.statSync(path.join(userDataPath, 'accounts.json')).mode & 0o777).toBe(0o600);
  });

  it('decrypts stored secrets only for main-process launch use', async () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-account-'));
    tempDirs.push(userDataPath);
    const encoded = (value: string) => Buffer.from(`encrypted:${value}`).toString('base64');
    fs.writeFileSync(path.join(userDataPath, 'accounts.json'), JSON.stringify({
      accounts: [{
        id: 'profile-1',
        type: 'third-party',
        name: 'PlayerOne',
        authServerUrl: 'https://skin.example.com/api/yggdrasil',
        encryptedAccessToken: encoded('access'),
        encryptedClientToken: encoded('client'),
      }],
      selectedAccountId: 'profile-1',
    }));

    const service = new AccountService(userDataPath);
    const internal = await service.ensureActiveAccountValid();

    expect(service.getSelectedAccount()).not.toHaveProperty('accessToken');
    expect(internal).toMatchObject({ accessToken: 'access', clientToken: 'client' });
  });

  it('disables provider accounts and removes plaintext secrets when secure storage is unavailable', async () => {
    mocked.encryptionAvailable = false;
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-account-'));
    tempDirs.push(userDataPath);
    fs.writeFileSync(path.join(userDataPath, 'accounts.json'), JSON.stringify({
      accounts: [{
        id: 'profile-1',
        type: 'third-party',
        name: 'PlayerOne',
        authServerUrl: 'https://skin.example.com/api/yggdrasil',
        accessToken: 'plain-access-token',
        clientToken: 'plain-client-token',
      }],
      selectedAccountId: 'profile-1',
    }));

    const service = new AccountService(userDataPath);
    const [account] = service.getAccounts();
    const persisted = fs.readFileSync(path.join(userDataPath, 'accounts.json'), 'utf8');

    expect(account).toMatchObject({
      isDisabled: true,
      disabledReason: 'secureStorageUnavailable',
    });
    expect(service.getSelectedAccount()).toBeNull();
    expect(await service.ensureActiveAccountValid()).toBeNull();
    expect(persisted).not.toContain('plain-access-token');
    await expect(service.addThirdPartyAccount(
      'https://skin.example.com/api/yggdrasil',
      'PlayerOne',
      'password',
    )).rejects.toThrow(/Secure credential storage/);

    mocked.encryptionAvailable = true;
    const reloadedService = new AccountService(userDataPath);
    expect(reloadedService.getAccounts()[0]).toMatchObject({
      isDisabled: true,
      disabledReason: 'reauthenticationRequired',
    });
    expect(reloadedService.getSelectedAccount()).toBeNull();
    expect(await reloadedService.ensureActiveAccountValid()).toBeNull();
  });
});
