import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ userDataPath: '/tmp/burrow-composition-root-test' }));

vi.mock('electron', () => ({
  app: {
    getPath: () => mocked.userDataPath,
    getAppPath: () => '/tmp/burrow-composition-root-test',
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    decryptString: () => '',
    encryptString: () => Buffer.from(''),
  },
}));

import { createCompositionRoot } from '../compositionRoot';

describe('createCompositionRoot', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    mocked.userDataPath = '/tmp/burrow-composition-root-test';
    for (const target of cleanup.splice(0)) fs.rmSync(target, { recursive: true, force: true });
  });

  it('exposes one canonical application identity to the IPC handler seam', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/burrow-user-data', appDataPath: '/tmp/burrow-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });

    expect(composition.handlerDependencies.application).toBe(composition.application);
    expect(composition.handlerDependencies.operations).toBe(composition.operations);
  });

  it('injects the same canonical application into sharing', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/burrow-user-data', appDataPath: '/tmp/burrow-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });

    expect(Reflect.get(composition.shareService, 'instanceReadPort')).toBe(composition.application);
  });

  it('injects the same canonical application into provider infrastructure', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/burrow-user-data', appDataPath: '/tmp/burrow-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });

    expect(Reflect.get(composition.modPlatforms, 'instanceApplication')).toBe(composition.application);
  });

  it('does not create a second graph while handlers are registered', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/burrow-user-data', appDataPath: '/tmp/burrow-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });
    const register = vi.fn();

    register(composition.handlerDependencies);

    expect(register).toHaveBeenCalledOnce();
    expect(register).toHaveBeenCalledWith(composition.handlerDependencies);
    expect(register.mock.calls[0][0].application).toBe(composition.application);
  });

  it('rejects incomplete production dependencies instead of defaulting a graph', () => {
    expect(() => createCompositionRoot({
      paths: { userDataPath: '', appDataPath: '/tmp/burrow-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    })).toThrow('Composition root requires user-data, app-data, and auth-server dependencies');
  });

  it('drains canonical owners and stops each independent network capability', async () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/burrow-user-data', appDataPath: '/tmp/burrow-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });
    const operations = vi.spyOn(composition.operations, 'beginShutdown');
    const instances = vi.spyOn(composition.application, 'beginShutdown');
    const tunnel = vi.spyOn(composition.burrowLink, 'stop');
    const lan = vi.spyOn(composition.lanDiscovery, 'stop');
    const upnp = vi.spyOn(composition.portMapping, 'stop');
    await expect(composition.shutdown()).resolves.toEqual({ failures: [] });
    expect(operations).toHaveBeenCalledOnce();
    expect(instances).toHaveBeenCalledOnce();
    expect(tunnel).toHaveBeenCalledOnce();
    expect(lan).toHaveBeenCalledOnce();
    expect(upnp).toHaveBeenCalledOnce();
  });

  it('seeds the canonical Classic profile on a clean first startup', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-composition-first-start-'));
    cleanup.push(base);
    mocked.userDataPath = path.join(base, 'user-data');
    const composition = createCompositionRoot({
      paths: { userDataPath: mocked.userDataPath, appDataPath: path.join(base, 'app-data') },
      authServerUrl: 'http://127.0.0.1:25530',
    });

    await composition.recoverOperations();
    const state = await composition.application.read(await composition.getDefaultInstanceRoot());

    expect(state).toMatchObject({
      status: 'ready',
      snapshot: {
        selectedId: 'classic',
        records: [{ id: 'classic', name: 'Classic' }],
      },
    });
    await composition.shutdown();
  });
});
