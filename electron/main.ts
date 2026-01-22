import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { AuthServer } from './auth/server'

// ... (imports)

// ...

// Auth Mock Server for Authlib Injector
const authServer = new AuthServer(25530);
authServer.start();
import { LauncherManager } from './launcher'
// import { Updater } from './updater'
import { SelfUpdater } from './self_updater'

// const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// DEV: If running on second port (5174), use a different User Data dir to allow 2 instances
if (VITE_DEV_SERVER_URL && VITE_DEV_SERVER_URL.includes(':5174')) {
  const newPath = app.getPath('userData') + '_2';
  app.setPath('userData', newPath);
  console.log(`[Main] Running as 2nd instance (Dev)! UserData: ${newPath}`);
} else {
  // PROD: Check single instance lock to support local testing (Host + Join on same PC)
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    // This is the SECOND instance. Instead of quitting, we isolate it.
    const newPath = app.getPath('userData') + '_2';
    app.setPath('userData', newPath);
    console.log(`[Main] Secondary Instance Detected. Switching UserData to: ${newPath}`);
  }
}

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 750,
    minHeight: 600,
    minWidth: 800,
    icon: path.join(process.env.VITE_PUBLIC, 'tray-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
    },
    frame: false, // Frameless window
    titleBarStyle: 'hidden', // Hide default title bar but keep traffic lights on macOS (optional, mostly for style)
  })
  console.log('[Main] Preload path:', path.join(__dirname, 'preload.cjs'));

  // Test active push message to Renderer-process.
  win?.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Initialize Auto Updater
  new SelfUpdater(win);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()

  // Tray Implementation
  const iconPath = path.join(process.env.VITE_PUBLIC, 'tray-icon.png');
  const tray = new Tray((nativeImage.createFromPath(iconPath)).resize({ width: 32, height: 32 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'FriendLauncher', enabled: false },
    { type: 'separator' },
    { label: 'Show Window', click: () => win?.show() },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('FriendLauncher');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (win?.isVisible()) {
      win.hide();
    } else {
      win?.show();
      win?.focus();
    }
  });

  // --- Managers Initialization ---
  let launcherManager: LauncherManager;
  try {
    console.log('[Main] Initializing Managers...');
    launcherManager = new LauncherManager();
    console.log('[Main] LauncherManager init success');
  } catch (e) {
    console.error('[Main] CRITICAL ERROR initializing LauncherManager:', e);
    // Continue running to show UI error if possible, but launcher won't work
    return;
  }

  // Initialize updater
  // const updater = new Updater(path.join(app.getPath('userData'), 'minecraft_data'));

  // --- Register IPC Handlers ---
  if (win && launcherManager) {
    import('./ipc/ipcManager').then(({ IPCManager }) => {
      IPCManager.register(win!, launcherManager, launcherManager.networkManager);
      console.log('[Main] IPC Handlers Registered');
    });
  }
})
