import { BrowserWindow, nativeImage, shell } from 'electron';
import path from 'node:path';

export type CreateMainWindowParams = {
  preloadPath: string;
  rendererDevUrl?: string;
  rendererDist: string;
  vitePublicPath: string;
};

export function createMainWindow(params: CreateMainWindowParams): BrowserWindow {
  const { preloadPath, rendererDevUrl, rendererDist, vitePublicPath } = params;

  const iconPath = path.join(vitePublicPath, 'icon.png');
  const appIcon = nativeImage.createFromPath(iconPath);

  // Размер окна: width/height — стартовый размер, minWidth/minHeight — минимум при ресайзе
  const win = new BrowserWindow({
    width: 1100,
    height: 850,
    minHeight: 600,
    minWidth: 800,
    icon: appIcon,
    title: 'FriendLauncher',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      // Security posture: keep Node out of renderer, use preload + contextBridge only.
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: Boolean(rendererDevUrl),
      webviewTag: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
  });

  // Prevent unexpected navigation / popups from renderer content.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const allowedOrigins = new Set<string>();
  if (rendererDevUrl) {
    try {
      allowedOrigins.add(new URL(rendererDevUrl).origin);
    } catch {
      // ignore
    }
  }

  win.webContents.on('will-navigate', (event, url) => {
    // Allow file:// navigation in production builds.
    if (url.startsWith('file://')) return;

    // Allow navigation within dev server origin.
    try {
      const origin = new URL(url).origin;
      if (allowedOrigins.has(origin)) return;
    } catch {
      // fallthrough
    }

    event.preventDefault();
    void shell.openExternal(url);
  });

  // Set window icon explicitly (for Windows taskbar)
  if (process.platform === 'win32') {
    win.setIcon(appIcon);
  }

  if (rendererDevUrl) {
    win.loadURL(rendererDevUrl);
  } else {
    win.loadFile(path.join(rendererDist, 'index.html'));
  }

  return win;
}

