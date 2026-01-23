import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { AuthServer } from './auth/server'
import { LauncherManager } from './launcher'
import { SelfUpdater } from './self_updater'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Start local Authlib mock server used by authlib-injector.
const authServer = new AuthServer(25530)
authServer.start()
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// In dev, allow two local instances by splitting userData.
if (VITE_DEV_SERVER_URL && VITE_DEV_SERVER_URL.includes(':5174')) {
  const newPath = app.getPath('userData') + '_2'
  app.setPath('userData', newPath)
} else {
  // In prod, isolate a second instance instead of exiting.
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    const newPath = app.getPath('userData') + '_2'
    app.setPath('userData', newPath)
  }
}

let win: BrowserWindow | null

// Create the main browser window and load the renderer.
function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'tray-icon.png')
  const appIcon = nativeImage.createFromPath(iconPath)
  
  win = new BrowserWindow({
    width: 1000,
    height: 750,
    minHeight: 600,
    minWidth: 800,
    icon: appIcon,
    title: 'FriendLauncher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
  })
  
  // Set window icon explicitly (for Windows taskbar)
  if (process.platform === 'win32') {
    win.setIcon(appIcon)
  }
  // Initialize auto-updater once the window exists.
  new SelfUpdater(win)

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
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
  // Set application name and metadata (must be called after app is ready)
  app.setName('FriendLauncher')
  app.setAppUserModelId('com.friendlauncher.app')
  
  createWindow()

  // Tray menu keeps the window accessible when hidden.
  const iconPath = path.join(process.env.VITE_PUBLIC, 'tray-icon.png')
  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 }))

  const contextMenu = Menu.buildFromTemplate([
    { label: 'FriendLauncher', enabled: false },
    { type: 'separator' },
    { label: 'Show Window', click: () => win?.show() },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setToolTip('FriendLauncher')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (win?.isVisible()) {
      win.hide()
    } else {
      win?.show()
      win?.focus()
    }
  })

  // --- Managers Initialization ---
  let launcherManager: LauncherManager
  try {
    launcherManager = new LauncherManager()
  } catch (e) {
    console.error('[Main] Failed to initialize LauncherManager:', e)
    return
  }

  // --- Register IPC Handlers ---
  if (win && launcherManager) {
    import('./ipc/ipcManager').then(({ IPCManager }) => {
      IPCManager.register(win!, launcherManager, launcherManager.networkManager)
    })
  }
})
