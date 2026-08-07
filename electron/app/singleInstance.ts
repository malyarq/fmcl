import { app, type BrowserWindow } from 'electron';
import path from 'node:path';

export type ApplicationInstanceData = Readonly<{
  version: string;
  executablePath: string;
}>;

function parseVersion(value: string): { core: [number, number, number]; prerelease?: string } | undefined {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
  if (!match) return undefined;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], ...(match[4] ? { prerelease: match[4] } : {}) };
}

export function isNewerApplicationVersion(current: string, incoming: string): boolean {
  const left = parseVersion(current);
  const right = parseVersion(incoming);
  if (!left || !right) return false;
  for (let index = 0; index < left.core.length; index += 1) {
    if (right.core[index] !== left.core[index]) return right.core[index] > left.core[index];
  }
  if (left.prerelease && !right.prerelease) return true;
  if (!left.prerelease || !right.prerelease) return false;
  return right.prerelease.localeCompare(left.prerelease, 'en', { numeric: true }) > 0;
}

function isTrustedLauncherExecutable(executablePath: string): boolean {
  if (!path.isAbsolute(executablePath) || executablePath.includes('\0')) return false;
  return /^FriendLauncher(?:-[A-Za-z0-9._-]+)?(?:\.exe|\.AppImage)?$/i.test(path.basename(executablePath));
}

export function resolveIncomingUpgrade(currentVersion: string, additionalData: unknown): ApplicationInstanceData | undefined {
  if (!additionalData || typeof additionalData !== 'object') return undefined;
  const candidate = additionalData as Partial<ApplicationInstanceData>;
  if (typeof candidate.version !== 'string' || typeof candidate.executablePath !== 'string') return undefined;
  if (!isNewerApplicationVersion(currentVersion, candidate.version) || !isTrustedLauncherExecutable(candidate.executablePath)) return undefined;
  return { version: candidate.version, executablePath: candidate.executablePath };
}

export function getCurrentExecutablePath(env: Readonly<Record<string, string | undefined>> = process.env, execPath = process.execPath): string {
  return env['APPIMAGE'] && path.isAbsolute(env['APPIMAGE']) ? env['APPIMAGE'] : execPath;
}

export function handleSecondApplicationInstance(params: {
  currentVersion: string;
  additionalData: unknown;
  window: BrowserWindow | null;
  relaunch: (options: { execPath: string }) => void;
  quit: () => void;
}): 'upgrade' | 'focus' {
  const upgrade = resolveIncomingUpgrade(params.currentVersion, params.additionalData);
  if (upgrade) {
    params.relaunch({ execPath: upgrade.executablePath });
    params.quit();
    return 'upgrade';
  }
  focusExistingWindow(params.window);
  return 'focus';
}

export function registerApplicationInstanceHandoff(getWindow: () => BrowserWindow | null): void {
  app.on('second-instance', (_event, _commandLine, _workingDirectory, additionalData) => {
    const result = handleSecondApplicationInstance({
      currentVersion: app.getVersion(),
      additionalData,
      window: getWindow(),
      relaunch: (options) => app.relaunch(options),
      quit: () => app.quit(),
    });
    if (result === 'upgrade') console.info(`[Lifecycle] Newer installed launcher requested a graceful relaunch from ${app.getVersion()}`);
  });
}

export function acquireApplicationInstance(rendererDevUrl?: string): boolean {
  if (rendererDevUrl?.includes(':5174')) {
    app.setPath('userData', `${app.getPath('userData')}_2`);
    return true;
  }
  return app.requestSingleInstanceLock({
    version: app.getVersion(),
    executablePath: getCurrentExecutablePath(),
  });
}

export function focusExistingWindow(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
