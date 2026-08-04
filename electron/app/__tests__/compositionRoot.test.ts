import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/fmcl-composition-root-test',
    getAppPath: () => '/tmp/fmcl-composition-root-test',
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
  it('exposes one canonical application identity to the IPC handler seam', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/fmcl-user-data', appDataPath: '/tmp/fmcl-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });

    expect(composition.handlerDependencies.application).toBe(composition.application);
    expect(composition.handlerDependencies.operations).toBe(composition.operations);
  });

  it('injects the same canonical application into sharing', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/fmcl-user-data', appDataPath: '/tmp/fmcl-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });

    expect(Reflect.get(composition.shareService, 'instanceReadPort')).toBe(composition.application);
  });

  it('injects the same canonical application into provider infrastructure', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/fmcl-user-data', appDataPath: '/tmp/fmcl-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    });

    expect(Reflect.get(composition.modPlatforms, 'instanceApplication')).toBe(composition.application);
  });

  it('does not create a second graph while handlers are registered', () => {
    const composition = createCompositionRoot({
      paths: { userDataPath: '/tmp/fmcl-user-data', appDataPath: '/tmp/fmcl-app-data' },
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
      paths: { userDataPath: '', appDataPath: '/tmp/fmcl-app-data' },
      authServerUrl: 'http://127.0.0.1:25530',
    })).toThrow('Composition root requires user-data, app-data, and auth-server dependencies');
  });
});
