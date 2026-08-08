import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  encryptionAvailable: true,
  encryptionChecks: 0,
  storageBackend: 'keychain' as 'basic_text' | 'keychain',
}));

vi.mock('electron', () => ({
  net: {
    fetch: async () => ({ status: 204 }),
  },
  safeStorage: {
    isEncryptionAvailable: () => { mocked.encryptionChecks += 1; return mocked.encryptionAvailable; },
    getSelectedStorageBackend: () => mocked.storageBackend,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^encrypted:/, ''),
  },
}));

import { AccountService } from '../accountService';

describe('AccountService secret boundaries', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    mocked.encryptionAvailable = true;
    mocked.encryptionChecks = 0;
    mocked.storageBackend = 'keychain';
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not touch secure storage for an empty persisted account list', () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
    tempDirs.push(userDataPath);
    fs.writeFileSync(path.join(userDataPath, 'accounts.json'), JSON.stringify({
      accounts: [],
      selectedAccountId: null,
      _fmclSchemaVersion: 1,
    }));

    expect(() => new AccountService(userDataPath)).not.toThrow();
    expect(mocked.encryptionChecks).toBe(0);
  });

  it('migrates plaintext tokens to encrypted persistence and never returns them to the renderer DTO', () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
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
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
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
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
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

  it('rejects Electron basic_text as insecure credential storage', async () => {
    mocked.storageBackend = 'basic_text';
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
    tempDirs.push(userDataPath);
    const accountsPath = path.join(userDataPath, 'accounts.json');
    const encoded = Buffer.from('encrypted:access').toString('base64');
    fs.writeFileSync(accountsPath, JSON.stringify({
      accounts: [{
        id: 'profile-1',
        type: 'third-party',
        name: 'PlayerOne',
        authServerUrl: 'https://skin.example.com/api/yggdrasil',
        encryptedAccessToken: encoded,
        encryptedClientToken: encoded,
      }],
      selectedAccountId: 'profile-1',
    }));

    const service = new AccountService(userDataPath);

    expect(fs.readFileSync(accountsPath, 'utf8')).not.toContain(encoded);
    expect(service.getAccounts()[0]).toMatchObject({
      isDisabled: true,
      disabledReason: 'secureStorageUnavailable',
    });

    await expect(service.addThirdPartyAccount(
      'https://skin.example.com/api/yggdrasil',
      'PlayerOne',
      'password',
    )).rejects.toThrow(/Secure credential storage/);
  });

  it('does not replace malformed account state with an empty account list', () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
    tempDirs.push(userDataPath);
    const accountsPath = path.join(userDataPath, 'accounts.json');
    fs.writeFileSync(accountsPath, '{malformed account state');
    const original = fs.readFileSync(accountsPath);

    expect(() => new AccountService(userDataPath)).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(accountsPath)).toEqual(original);
    expect(fs.existsSync(`${accountsPath}.bak`)).toBe(false);
  });

  it('rejects structurally invalid account entries instead of crashing during hydration', () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
    tempDirs.push(userDataPath);
    const accountsPath = path.join(userDataPath, 'accounts.json');
    fs.writeFileSync(accountsPath, JSON.stringify({
      accounts: [null],
      selectedAccountId: null,
    }));
    const original = fs.readFileSync(accountsPath);

    expect(() => new AccountService(userDataPath)).toThrow(/recovery backup are unavailable/);
    expect(fs.readFileSync(accountsPath)).toEqual(original);
  });

  it('recovers from a valid backup and preserves the corrupt primary for diagnosis', () => {
    const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-account-'));
    tempDirs.push(userDataPath);
    const accountsPath = path.join(userDataPath, 'accounts.json');
    fs.writeFileSync(accountsPath, '{malformed account state');
    fs.writeFileSync(`${accountsPath}.bak`, JSON.stringify({
      accounts: [{ id: 'offline-1', type: 'offline', name: 'Recovered Player' }],
      selectedAccountId: 'offline-1',
    }));

    const service = new AccountService(userDataPath);

    expect(service.getSelectedAccount()).toMatchObject({
      id: 'offline-1',
      name: 'Recovered Player',
    });
    expect(fs.readFileSync(`${accountsPath}.corrupt`, 'utf8')).toBe('{malformed account state');
    expect(JSON.parse(fs.readFileSync(accountsPath, 'utf8'))).toMatchObject({
      _fmclSchemaVersion: 1,
      selectedAccountId: 'offline-1',
    });
  });
});
