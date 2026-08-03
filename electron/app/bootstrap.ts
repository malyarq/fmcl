import { app, ipcMain, BrowserWindow, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { AuthServer } from '../auth/server';
import { LauncherManager } from '../services/launcher/orchestrator';
import { SelfUpdater } from '../services/updater/appUpdater';
import { IPCManager } from '../ipc/ipcManager';
import { createMainWindow, createConsoleWindow, getNativeWindowIconCandidates } from '../window/windowManager';
import { createTray } from '../tray/trayManager';
import { registerLifecycleHandlers } from './lifecycle';
import { ModPlatformService } from '../services/mods/platform/modPlatformService';
import { ModpackService } from '../services/modpacks/modpackService';
import { NetworkService } from '../services/network/networkService';
import { NetworkManager } from '../services/network/networkManager';
import { runFullInstallationTest } from './fullInstallationTest';
import { ContentManager } from '../services/content/contentManager';
import { AccountService } from '../services/account/accountService';
import { MirrorsService } from '../services/mirrors/mirrorsService';
import { StatisticsService } from '../services/stats/statisticsService';
import { ShareService } from '../services/sharing/shareService';
import { loadFullTestConfig } from './fullTestConfig';
import { OperationRunner } from '../services/operations/operationRunner';
import { createDuplicateOperationAdapter } from '../services/operations/duplicateOperation';
import { createImportOperationAdapter } from '../services/operations/importOperation';
import { createLiveProviderInstallers, createProviderInstallOperationAdapters } from '../services/operations/providerInstallOperation';
import { createUpdateOperationAdapter } from '../services/operations/updateOperation';
import { createDeleteOperationAdapter } from '../services/operations/deleteOperation';
import { createExportOperationAdapter } from '../services/operations/exportOperation';
import { InstanceExporterService } from '../services/instances/exporter/InstanceExporterService';
import { exportToZip } from '../services/modpacks/exporters/zipExporter';

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
  if (!testUserDataPath) {
    return;
  }

  if (process.env['NODE_ENV'] !== 'test' || !path.isAbsolute(testUserDataPath)) {
    throw new Error('FMCL_TEST_USER_DATA requires NODE_ENV=test and an absolute path');
  }

  fs.mkdirSync(testUserDataPath, { recursive: true });
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

function startAuthServer(): { url: string } {
  const port = resolveAuthServerPort();
  const url = `http://127.0.0.1:${port}`;

  // Start local Authlib mock server used by authlib-injector.
  // If the port is already in use, AuthServer logs and we assume another instance provides it.
  const authServer = new AuthServer(port);
  authServer.start();

  return { url };
}

function createServices(deps: { authServerUrl: string; accountService: AccountService; mirrorsService: MirrorsService; statisticsService: StatisticsService }) {
  const modpacks = new ModpackService(new ContentManager(app.getPath('userData')));
  const networkManager = new NetworkManager();

  const launcherManager = new LauncherManager({
    instances: modpacks,
    networkManager,
    authServerUrl: deps.authServerUrl,
    accountService: deps.accountService,
    mirrorsService: deps.mirrorsService,
    statisticsService: deps.statisticsService,
  });

  const modPlatforms = new ModPlatformService();
  const networkService = new NetworkService(networkManager);
  const shareService = new ShareService(modpacks);

  return {
    modpacks,
    networkManager,
    launcherManager,
    modPlatforms,
    networkService,
    shareService,
  };
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

  registerLifecycleHandlers({ createWindow });

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
    const { url: authServerUrl } = startAuthServer();
    const win = createWindow();

    // Tray menu keeps the window accessible when hidden.
    createTray({
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

    const accountService = new AccountService(app.getPath('userData'));
    const mirrorsService = new MirrorsService();
    const statisticsService = new StatisticsService();
    const { modpacks, launcherManager, modPlatforms, networkService, shareService } = createServices({ authServerUrl, accountService, mirrorsService, statisticsService });
    const instanceExporter = new InstanceExporterService(modpacks);
    const operations = new OperationRunner([
      createDuplicateOperationAdapter(),
      createImportOperationAdapter(),
      createUpdateOperationAdapter(),
      createDeleteOperationAdapter(),
      createExportOperationAdapter({
        platformService: modPlatforms,
        writeArchive: async ({ rootPath, instanceId, format, outputPath, options }) => {
          const hasInstanceExportOptions = options?.includeSaves !== undefined
            || options?.includeScreenshots !== undefined
            || options?.includeResourcePacks !== undefined
            || options?.includeShaders !== undefined
            || options?.includeMods !== undefined;
          if (format === 'multimc' || hasInstanceExportOptions) {
            await instanceExporter.exportInstance(rootPath, instanceId, format, outputPath, options);
            return;
          }
          await exportToZip(modpacks.getModpackDir(rootPath, instanceId), outputPath);
        },
      }),
      ...createProviderInstallOperationAdapters({
        installers: createLiveProviderInstallers(modpacks, {
          curseforge: () => modPlatforms.getCurseForgeClient(),
          modrinth: () => modPlatforms.getModrinthClient(),
        }),
      }),
    ], { registryPath: app.getPath('appData') });

    // Recovery must finish before mutating operation handlers are registered.
    await operations.recoverRegistered(modpacks.getDefaultRootPath());

    // --- Register IPC Handlers ---
    IPCManager.registerAllHandlers({
      window: win,
      launcher: launcherManager,
      modPlatforms,
      networkService,
      modpacks,
      accountService,
      mirrorsService,
      statisticsService,
      shareService,
      operations,
    });

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
  });
}
