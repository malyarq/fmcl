import { app, ipcMain, BrowserWindow, nativeImage, type Tray } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { AuthServer } from '../auth/server';
import { SelfUpdater } from '../services/updater/appUpdater';
import { IPCManager } from '../ipc/ipcManager';
import { createMainWindow, createConsoleWindow, getNativeWindowIconCandidates } from '../window/windowManager';
import { createTray } from '../tray/trayManager';
import { registerLifecycleHandlers } from './lifecycle';
import { runFullInstallationTest } from './fullInstallationTest';
import { loadFullTestConfig } from './fullTestConfig';
import { createCompositionRoot } from './compositionRoot';
import { ApplicationLifecycle } from './applicationLifecycle';

function configureAppRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Important: in build output, `__dirname` resolves to `dist-electron/`.
  // App root must be `dist-electron/..` (same as the previous `electron/main.ts` behavior),
  // otherwise preload/renderer paths will point to non-existent locations.
  process.env.APP_ROOT = path.join(__dirname, '..');
}

function configureIsolatedTestUserData(): void {
  const testUserDataPath = process.env['FMCL_TEST_USER_DATA'];
  if (!testUserDataPath) return;

  if (process.env['NODE_ENV'] !== 'test' || !path.isAbsolute(testUserDataPath)) {
    throw new Error('FMCL_TEST_USER_DATA requires NODE_ENV=test and an absolute path');
  }

  fs.mkdirSync(testUserDataPath, { recursive: true });
  app.setPath('appData', path.join(testUserDataPath, 'app-data'));
  fs.mkdirSync(app.getPath('appData'), { recursive: true });
  app.setPath('userData', testUserDataPath);
}

function resolveRuntimePaths() {
  // 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
  const rendererDevUrl = process.env['VITE_DEV_SERVER_URL'];
  const appRoot = process.env.APP_ROOT!;
  const mainDist = path.join(appRoot, 'dist-electron');
  const rendererDist = path.join(appRoot, 'dist');

  process.env.VITE_PUBLIC = rendererDevUrl ? path.join(appRoot, 'public') : rendererDist;

  return {
    rendererDevUrl,
    mainDist,
    rendererDist,
    vitePublicPath: process.env.VITE_PUBLIC!,
  };
}

function configureMultiInstanceSupport(rendererDevUrl?: string) {
  // In dev, allow two local instances by splitting userData.
  if (rendererDevUrl && rendererDevUrl.includes(':5174')) {
    const newPath = app.getPath('userData') + '_2';
    app.setPath('userData', newPath);
    return;
  }

  // In prod, isolate a second instance instead of exiting.
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    const newPath = app.getPath('userData') + '_2';
    app.setPath('userData', newPath);
  }
}

function resolveAuthServerPort() {
  // If multiple instances are allowed, avoid port collision by giving each slot its own port.
  // Default instance: 25530, second instance: 25531, etc.
  const userData = app.getPath('userData');
  const match = /_(\d+)$/.exec(userData);
  const slot = match ? Math.max(1, Number(match[1])) : 1;
  return 25530 + (slot - 1);
}

function createAuthServer(): AuthServer {
  const port = resolveAuthServerPort();
  return new AuthServer(port);
}

function resolveNativeIconPath(vitePublicPath: string): string {
  for (const iconFileName of getNativeWindowIconCandidates(process.platform)) {
    const iconPath = path.join(vitePublicPath, iconFileName);
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }

  return path.join(vitePublicPath, 'icon.png');
}

function applyNativeAppIcon(vitePublicPath: string): string {
  const iconPath = resolveNativeIconPath(vitePublicPath);
  const appIcon = nativeImage.createFromPath(iconPath);

  if (process.platform === 'darwin' && !appIcon.isEmpty()) {
    app.dock?.setIcon(appIcon);
  }

  return iconPath;
}

export function bootstrapMain() {
  // Set app name BEFORE any calls to app.getPath('userData')
  // This ensures the userData folder uses the correct name
  app.setName('.fmcl');
  app.setAppUserModelId('com.friendlauncher.app');
  configureIsolatedTestUserData();

  configureAppRoot();
  const paths = resolveRuntimePaths();
  configureMultiInstanceSupport(paths.rendererDevUrl);

  let winRef: ReturnType<typeof createMainWindow> | null = null;

  const createWindow = () => {
    const win = createMainWindow({
      preloadPath: path.join(paths.mainDist, 'preload.cjs'),
      rendererDevUrl: paths.rendererDevUrl,
      rendererDist: paths.rendererDist,
      vitePublicPath: paths.vitePublicPath,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    winRef = win;
    // Initialize auto-updater once the window exists.
    new SelfUpdater(win);
    return win;
  };

  let applicationLifecycle: ApplicationLifecycle | undefined;
  registerLifecycleHandlers({
    createWindow,
    shutdown: async () => { await applicationLifecycle?.shutdown(); },
  });

  app.whenReady().then(async () => {
    // Check for test configuration file
    const testConfig = loadFullTestConfig();
    if (testConfig?.enabled) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { enabled, ...testParams } = testConfig;
      const exitCode = await runFullInstallationTest(testParams);
      app.exit(exitCode);
      return;
    }

    const nativeIconPath = applyNativeAppIcon(paths.vitePublicPath);
    const authServer = createAuthServer();
    let composition: ReturnType<typeof createCompositionRoot> | undefined;
    let tray: Tray | undefined;
    try {
      const { url: authServerUrl } = await authServer.start();
      composition = createCompositionRoot({
        paths: { userDataPath: app.getPath('userData'), appDataPath: app.getPath('appData') },
        authServerUrl,
      });

      // Recovery is part of startup and finishes before any window can submit
      // a mutation or observe an incomplete canonical state.
      await composition.recoverOperations();
      const win = createWindow();

      tray = createTray({
        iconPath: nativeIconPath,
        onShowWindow: () => winRef?.show(),
        onQuit: () => app.quit(),
        onToggleWindowVisibility: () => {
          if (winRef?.isVisible()) winRef.hide();
          else {
            winRef?.show();
            winRef?.focus();
          }
        },
      });

      applicationLifecycle = new ApplicationLifecycle({
        unregisterIpc: () => IPCManager.unregisterAllHandlers(),
        shutdownComposition: () => composition!.shutdown(),
        stopAuthServer: () => authServer.stop(),
        destroyTray: () => tray?.destroy(),
      });

      IPCManager.registerAllHandlers({ window: win, composition: composition.handlerDependencies });

      let consoleWinRef: BrowserWindow | null = null;
      ipcMain.handle('window:openConsole', () => {
        if (consoleWinRef && !consoleWinRef.isDestroyed()) {
          consoleWinRef.show();
          consoleWinRef.focus();
          return;
        }

        consoleWinRef = createConsoleWindow({
          preloadPath: path.join(paths.mainDist, 'preload.cjs'),
          rendererDevUrl: paths.rendererDevUrl,
          rendererDist: paths.rendererDist,
          vitePublicPath: paths.vitePublicPath,
        });

        consoleWinRef.on('closed', () => {
          consoleWinRef = null;
        });
      });

      ipcMain.handle('window:closeConsole', () => {
        if (consoleWinRef && !consoleWinRef.isDestroyed()) {
          consoleWinRef.close();
        }
        consoleWinRef = null;
      });
    } catch (error) {
      const partialLifecycle = applicationLifecycle ?? new ApplicationLifecycle({
        unregisterIpc: () => IPCManager.unregisterAllHandlers(),
        shutdownComposition: async () => composition ? await composition.shutdown() : { failures: [] },
        stopAuthServer: () => authServer.stop(),
        destroyTray: () => tray?.destroy(),
      });
      await partialLifecycle.shutdown();
      console.error('[Bootstrap] Startup failed:', error);
      app.exit(1);
    }
  });
}
