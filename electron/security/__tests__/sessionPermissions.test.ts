import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerTrustedRendererPermissions } from '../sessionPermissions';

function createWebContents() {
  let destroyed = false;
  let destroyedHandler: (() => void) | undefined;

  return {
    isDestroyed: () => destroyed,
    once: vi.fn((_event: string, handler: () => void) => {
      destroyedHandler = handler;
    }),
    destroy: () => {
      destroyed = true;
      destroyedHandler?.();
    },
  };
}

function createPermissionSession() {
  let checkHandler: ((webContents: never, permission: string) => boolean) | undefined;
  let requestHandler: (
    webContents: never,
    permission: string,
    callback: (allowed: boolean) => void,
  ) => void = () => undefined;

  return {
    session: {
      setPermissionCheckHandler: vi.fn((handler) => {
        checkHandler = handler;
      }),
      setPermissionRequestHandler: vi.fn((handler) => {
        requestHandler = handler;
      }),
    },
    check: (webContents: unknown, permission: string) => checkHandler?.(webContents as never, permission),
    request: (webContents: unknown, permission: string) => new Promise<boolean>((resolve) => {
      requestHandler(webContents as never, permission, resolve);
    }),
  };
}

describe('registerTrustedRendererPermissions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows sanitized clipboard writes only for registered live renderers', async () => {
    const permissions = createPermissionSession();
    const trusted = createWebContents();
    const unknown = createWebContents();

    registerTrustedRendererPermissions(permissions.session as never, trusted as never);

    expect(permissions.check(trusted, 'clipboard-sanitized-write')).toBe(true);
    await expect(permissions.request(trusted, 'clipboard-sanitized-write')).resolves.toBe(true);
    expect(permissions.check(unknown, 'clipboard-sanitized-write')).toBe(false);
    await expect(permissions.request(trusted, 'geolocation')).resolves.toBe(false);

    trusted.destroy();
    expect(permissions.check(trusted, 'clipboard-sanitized-write')).toBe(false);
  });

  it('installs one shared policy for multiple windows in the same session', () => {
    const permissions = createPermissionSession();
    const first = createWebContents();
    const second = createWebContents();

    registerTrustedRendererPermissions(permissions.session as never, first as never);
    registerTrustedRendererPermissions(permissions.session as never, second as never);

    expect(permissions.session.setPermissionCheckHandler).toHaveBeenCalledTimes(1);
    expect(permissions.session.setPermissionRequestHandler).toHaveBeenCalledTimes(1);
    expect(permissions.check(first, 'clipboard-sanitized-write')).toBe(true);
    expect(permissions.check(second, 'clipboard-sanitized-write')).toBe(true);
  });
});
