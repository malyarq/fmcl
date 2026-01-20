import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import http from 'http'
import crypto from 'crypto'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// ... (imports)

// ...

// Auth Mock Server for Authlib Injector
// Acts as a "Permissive Yggdrasil"
// Generate RSA Keypair for signing (required by authlib-injector)
const { publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

const authServer = http.createServer((req, res) => {
  // Authlib Injector might send Host header, so we just use 127.0.0.1:25530 as base
  const url = new URL(req.url || '', `http://127.0.0.1:25530`);
  console.log('[AuthMock] Request:', req.method, url.pathname);

  // X-Authlib-Injector-Yggdrasil-Server: ...
  if (req.headers['x-authlib-injector-yggdrasil-server']) {
    res.setHeader('X-Authlib-Injector-Yggdrasil-Server', req.headers['x-authlib-injector-yggdrasil-server']);
  }

  // 1. Root / Metadata (Authlib Injector check)
  // GET / (or /api/yggdrasil/...)
  if (url.pathname === '/' || url.pathname === '/authserver/' || url.pathname === '/api/yggdrasil') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      meta: {
        serverName: "OfflineMock",
        implementationName: "OfflineMock",
        implementationVersion: "1.0.0"
      },
      skinDomains: ["localhost"],
      signaturePublickey: publicKey // Serve the generated PEM key
    }));
    return;
  }

  // 2. Session Join (Client -> Mojang)
  // POST /sessionserver/session/minecraft/join
  if (req.method === 'POST' && url.pathname.includes('/join')) {
    res.writeHead(204);
    res.end();
    return;
  }

  // 3. Session HasJoined (Server -> Mojang)
  // GET /sessionserver/session/minecraft/hasJoined
  if (req.method === 'GET' && url.pathname.includes('/hasJoined')) {
    const username = url.searchParams.get('username') || 'Unknown';
    const md5 = crypto.createHash('md5');
    md5.update(`OfflinePlayer:${username}`);
    const buffer = md5.digest();
    buffer[6] = (buffer[6] & 0x0f) | 0x30;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    const uuid = buffer.toString('hex');

    const responseCtx = {
      id: uuid,
      name: username,
      properties: []
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(responseCtx));
    return;
  }

  // 4. Batch Profile Lookup (Name -> UUID)
  // POST /api/profiles/minecraft
  if (req.method === 'POST' && url.pathname.includes('/profiles/minecraft')) {
    // Read body to get names?
    // For now just return empty or fake.
    // Actually Client sends names, expects UUIDs.
    // We can just return empty array if we don't care about skins in lobby.
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('[]');
    return;
  }

  // Default
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end('{}');
});

authServer.on('error', (e: any) => {
  if (e.code === 'EADDRINUSE') {
    console.log('[AuthMock] Port 25530 busy. Assuming another instance is providing Auth.');
  } else {
    console.error('[AuthMock] Server Error:', e);
  }
});

authServer.listen(25530, '127.0.0.1', () => {
  console.log('[AuthMock] Permissive Yggdrasil running on 127.0.0.1:25530');
});
import { LauncherManager } from './launcher'
import { Updater } from './updater'
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
  // In production, we might need a .ico or proper sizing, but .svg/png works for now
  const tray = new Tray((nativeImage.createFromPath(iconPath)).resize({ width: 32, height: 32 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'FriendLauncher', enabled: false },
    { type: 'separator' },
    { label: 'Show Window', click: () => win?.show() },
    {
      label: 'Quit', click: () => {
        // Force quit
        app.quit();
      }
    }
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

  let launcherManager: LauncherManager | null = null;
  try {
    console.log('[Main] Initializing LauncherManager...');
    launcherManager = new LauncherManager();
    console.log('[Main] LauncherManager init success');
  } catch (e) {
    console.error('[Main] CRITICAL ERROR initializing LauncherManager:', e);
  }

  // Auth Mock Server to force Offline Mode gracefully
  // Connection Refused -> AuthenticationUnavailableException -> "Maintenance" (Kick)
  // 403 Forbidden -> InvalidCredentialsException -> "Offline" (Allow)
  // Auth Mock Server & Proxy removed as they are ineffective for 1.12.2 Authlib.
  // The correct solution is to use a Mod (Lan Server Properties) to disable Online Mode.

  // Initialize updater with fixed path for now (or dynamic based on modpack)
  const updater = new Updater(path.join(app.getPath('userData'), 'minecraft_data'));

  ipcMain.handle('launcher:launch', async (event, options) => {
    if (!launcherManager) return;

    const shouldHide = options.hideLauncher;
    // Removed immediate hide logic here to prevent hiding on error

    try {
      await launcherManager.launchGame(
        options,
        (log) => event.sender.send('launcher:log', log),
        (progress) => event.sender.send('launcher:progress', progress),
        (code) => {
          event.sender.send('launcher:close', code);
          // Always restore window when game closes
          if (shouldHide && win) {
            win.show();
            win.focus();
          }
        },
        () => {
          // Game Successfully Started
          if (shouldHide && win) {
            win.hide();
          }
        }
      );
      return { success: true }
    } catch (error) {
      // If launch fails, ensure window is back (though it shouldn't have hidden yet)
      if (shouldHide && win) win.show();
      console.error(error)
      throw error
    }
  })

  ipcMain.handle('updater:sync', async (_event, manifestUrl) => {
    if (!win) return
    try {
      await updater.sync(manifestUrl, (status, progress) => {
        win?.webContents.send('updater:progress', { status, progress })
      })
      return { success: true }
    } catch (error) {
      console.error(error)
      throw error
    }
  })

  // Network (P2P) Handlers
  ipcMain.handle('network:host', async (_event, port) => {
    if (!launcherManager) throw new Error('Launcher Manager failed to initialize.');
    return await launcherManager.networkManager.host(port, (msg) => _event.sender.send('launcher:log', msg));
  });

  ipcMain.handle('network:join', async (_event, code) => {
    if (!launcherManager) throw new Error('Launcher Manager failed to initialize.');
    return await launcherManager.networkManager.join(code, (msg) => _event.sender.send('launcher:log', msg));
  });

  ipcMain.handle('network:stop', async (_event) => {
    if (!launcherManager) return;
    return await launcherManager.networkManager.stop((msg) => _event.sender.send('launcher:log', msg));
  });

  // Window Controls
  ipcMain.handle('window:minimize', () => {
    console.log('[Main] Minimizing window requested');
    win?.minimize();
  });

  ipcMain.handle('window:close', () => {
    win?.close();
  });
})
