import { BrowserWindow, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { openExternalUrl } from '../security/externalUrls';

export type CreateMainWindowParams = {
  preloadPath: string;
  rendererDevUrl?: string;
  rendererDist: string;
  vitePublicPath: string;
};

type MainWindowChromeOptions = {
  frame: boolean;
  titleBarStyle: 'hidden' | 'hiddenInset';
};

function buildAllowedOrigins(rendererDevUrl?: string): Set<string> {
  const allowedOrigins = new Set<string>();
  if (!rendererDevUrl) {
    return allowedOrigins;
  }

  try {
    allowedOrigins.add(new URL(rendererDevUrl).origin);
  } catch {
    // ignore invalid dev URL
  }

  return allowedOrigins;
}

function allowInternalWindowUrl(url: string, allowedOrigins: ReadonlySet<string>): boolean {
  if (url.startsWith('file://')) {
    return true;
  }

  try {
    return allowedOrigins.has(new URL(url).origin);
  } catch {
    return false;
  }
}

function resolveWindowIconPath(vitePublicPath: string): string {
  const candidates =
    process.platform === 'darwin'
      ? ['icon-macos.png', 'icon.png', 'icon.ico']
      : process.platform === 'win32'
        ? ['icon.ico', 'icon.png', 'icon-macos.png']
        : ['icon.png', 'icon.ico', 'icon-macos.png'];

  for (const iconFileName of candidates) {
    const candidatePath = path.join(vitePublicPath, iconFileName);
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }

  return path.join(vitePublicPath, 'icon.png');
}

function resolveMainWindowChromeOptions(): MainWindowChromeOptions {
  if (process.platform === 'darwin') {
    return {
      // Native traffic lights require the real macOS frame; the renderer only owns
      // the clearance/drag strip underneath that chrome.
      frame: true,
      titleBarStyle: 'hiddenInset',
    };
  }

  return {
    frame: false,
    titleBarStyle: 'hidden',
  };
}

function attachExternalNavigationGuards(
  win: BrowserWindow,
  allowedOrigins: ReadonlySet<string>,
  contextPrefix: string,
): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(
      { url, context: `${contextPrefix} popup` },
      { parentWindow: win, showBlockedDialog: true },
    );
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (allowInternalWindowUrl(url, allowedOrigins)) {
      return;
    }

    event.preventDefault();
    void openExternalUrl(
      { url, context: `${contextPrefix} navigation` },
      { parentWindow: win, showBlockedDialog: true },
    );
  });
}

export function createMainWindow(params: CreateMainWindowParams): BrowserWindow {
  const { preloadPath, rendererDevUrl, rendererDist, vitePublicPath } = params;

  const iconPath = resolveWindowIconPath(vitePublicPath);
  const appIcon = nativeImage.createFromPath(iconPath);
  const allowedOrigins = buildAllowedOrigins(rendererDevUrl);
  const chromeOptions = resolveMainWindowChromeOptions();

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
      // Phase 1 keeps sandbox disabled until the preload surface is boot-verified under sandbox.
      // Compensating controls stay enforced through context isolation, the IPC allowlist, and
      // the shared external-link trust gates below.
      sandbox: false,
      // Security posture: keep Node out of renderer, use preload + contextBridge only.
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      devTools: Boolean(rendererDevUrl),
      webviewTag: false,
    },
    ...chromeOptions,
  });

  attachExternalNavigationGuards(win, allowedOrigins, 'Main window');

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

export function createConsoleWindow(params: CreateMainWindowParams): BrowserWindow {
  const { preloadPath, rendererDevUrl, rendererDist, vitePublicPath } = params;

  const iconPath = resolveWindowIconPath(vitePublicPath);
  const appIcon = nativeImage.createFromPath(iconPath);
  const allowedOrigins = buildAllowedOrigins(rendererDevUrl);

  const win = new BrowserWindow({
    width: 900,
    height: 600,
    minHeight: 400,
    minWidth: 600,
    icon: appIcon,
    title: 'Debug Console',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
      webviewTag: false,
      devTools: Boolean(rendererDevUrl),
    },
    // Console window has standard frame/titlebar
    autoHideMenuBar: true,
  });

  attachExternalNavigationGuards(win, allowedOrigins, 'Console window');

  if (process.platform === 'win32') {
    win.setIcon(appIcon);
  }

  // Load with hash #console
  if (rendererDevUrl) {
    win.loadURL(`${rendererDevUrl}#console`);
  } else {
    // In production, loading file://.../index.html#console works
    win.loadURL(`file://${path.join(rendererDist, 'index.html')}#console`);
  }

  return win;
}
