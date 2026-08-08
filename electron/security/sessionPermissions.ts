import type { Session, WebContents } from 'electron';

type PermissionSession = Pick<Session, 'setPermissionCheckHandler' | 'setPermissionRequestHandler'>;
type TrustedWebContents = Pick<WebContents, 'isDestroyed' | 'once'>;

const trustedContentsBySession = new WeakMap<PermissionSession, Set<TrustedWebContents>>();

function isTrusted(
  trustedContents: ReadonlySet<TrustedWebContents>,
  webContents: WebContents | null,
): boolean {
  return webContents !== null
    && !webContents.isDestroyed()
    && trustedContents.has(webContents);
}

/**
 * Electron grants several web permissions by default. Burrow only needs sanitized
 * clipboard writes, and only from its own guarded renderer windows.
 */
export function registerTrustedRendererPermissions(
  permissionSession: PermissionSession,
  webContents: TrustedWebContents,
): void {
  let trustedContents = trustedContentsBySession.get(permissionSession);

  if (!trustedContents) {
    trustedContents = new Set<TrustedWebContents>();
    trustedContentsBySession.set(permissionSession, trustedContents);

    permissionSession.setPermissionCheckHandler((requestingWebContents, permission) => (
      permission === 'clipboard-sanitized-write'
      && isTrusted(trustedContents!, requestingWebContents)
    ));

    permissionSession.setPermissionRequestHandler((requestingWebContents, permission, callback) => {
      callback(
        permission === 'clipboard-sanitized-write'
        && isTrusted(trustedContents!, requestingWebContents),
      );
    });
  }

  trustedContents.add(webContents);
  webContents.once('destroyed', () => {
    trustedContents?.delete(webContents);
  });
}
