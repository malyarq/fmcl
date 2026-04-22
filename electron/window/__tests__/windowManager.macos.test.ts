import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BrowserWindowOptions = {
  frame?: boolean;
  titleBarStyle?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  title?: string;
  webPreferences?: {
    preload?: string;
    sandbox?: boolean;
    contextIsolation?: boolean;
    nodeIntegration?: boolean;
    nodeIntegrationInWorker?: boolean;
    nodeIntegrationInSubFrames?: boolean;
    webSecurity?: boolean;
    allowRunningInsecureContent?: boolean;
    navigateOnDragDrop?: boolean;
    devTools?: boolean;
    webviewTag?: boolean;
  };
};

const mocked = vi.hoisted(() => {
  const browserWindowOptions: BrowserWindowOptions[] = [];
  const setWindowOpenHandler = vi.fn();
  const webContentsOn = vi.fn();
  const loadURL = vi.fn();
  const loadFile = vi.fn();
  const setIcon = vi.fn();
  const createFromPath = vi.fn((iconPath: string) => ({ iconPath }));

  class MockBrowserWindow {
    public readonly webContents = {
      setWindowOpenHandler,
      on: webContentsOn,
    };

    public readonly loadURL = loadURL;
    public readonly loadFile = loadFile;
    public readonly setIcon = setIcon;

    constructor(options: BrowserWindowOptions) {
      browserWindowOptions.push(options);
    }
  }

  return {
    browserWindowOptions,
    setWindowOpenHandler,
    webContentsOn,
    loadURL,
    loadFile,
    setIcon,
    createFromPath,
    MockBrowserWindow,
  };
});

vi.mock('electron', () => ({
  BrowserWindow: mocked.MockBrowserWindow,
  nativeImage: {
    createFromPath: mocked.createFromPath,
  },
}));

vi.mock('../../security/externalUrls', () => ({
  openExternalUrl: vi.fn(),
}));

import { createMainWindow, getNativeWindowIconCandidates } from '../windowManager';

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-window-manager-macos-'));
}

const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');

function setProcessPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value,
  });
}

describe('createMainWindow macOS chrome contract', () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    mocked.browserWindowOptions.length = 0;
    mocked.setWindowOpenHandler.mockReset();
    mocked.webContentsOn.mockReset();
    mocked.loadURL.mockReset();
    mocked.loadFile.mockReset();
    mocked.setIcon.mockReset();
    mocked.createFromPath.mockReset();
    mocked.createFromPath.mockImplementation((iconPath: string) => ({ iconPath }));

    setProcessPlatform('darwin');
  });

  afterEach(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }

    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates a native-first hidden-inset macOS window without frameless renderer chrome', () => {
    const vitePublicPath = createTempDir();
    tempDirs.push(vitePublicPath);
    fs.writeFileSync(path.join(vitePublicPath, 'icon-macos.png'), 'icon');

    createMainWindow({
      preloadPath: '/preload.js',
      rendererDevUrl: 'http://127.0.0.1:5173',
      rendererDist: '/renderer-dist',
      vitePublicPath,
    });

    const [options] = mocked.browserWindowOptions;
    expect(options).toBeDefined();
    if (!options) {
      throw new Error('Expected BrowserWindow to be constructed');
    }

    expect(options).toMatchObject({
      frame: true,
      titleBarStyle: 'hiddenInset',
      width: 1100,
      height: 850,
      minWidth: 800,
      minHeight: 600,
      title: 'FriendLauncher',
      webPreferences: {
        preload: '/preload.js',
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInWorker: false,
        nodeIntegrationInSubFrames: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        navigateOnDragDrop: false,
        devTools: true,
        webviewTag: false,
      },
    });
    expect(mocked.createFromPath).toHaveBeenCalledWith(path.join(vitePublicPath, 'icon-macos.png'));
    expect(mocked.loadURL).toHaveBeenCalledWith('http://127.0.0.1:5173');
    expect(mocked.loadFile).not.toHaveBeenCalled();
    expect(mocked.setIcon).not.toHaveBeenCalled();
  });

  it('keeps macOS native icon resolution PNG-first and only falls back to ico last', () => {
    const vitePublicPath = createTempDir();
    tempDirs.push(vitePublicPath);
    fs.writeFileSync(path.join(vitePublicPath, 'icon.png'), 'png');
    fs.writeFileSync(path.join(vitePublicPath, 'icon.ico'), 'ico');

    createMainWindow({
      preloadPath: '/preload.js',
      rendererDevUrl: 'http://127.0.0.1:5173',
      rendererDist: '/renderer-dist',
      vitePublicPath,
    });

    expect(getNativeWindowIconCandidates('darwin')).toEqual(['icon-macos.png', 'icon.png', 'icon.ico']);
    expect(mocked.createFromPath).toHaveBeenCalledWith(path.join(vitePublicPath, 'icon.png'));
  });
});
