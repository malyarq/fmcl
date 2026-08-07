import { BrowserWindow, ipcMain } from 'electron';
import { createConsoleWindow } from '../window/windowManager';

export function registerConsoleWindowHandlers(paths: {
  preloadPath: string;
  rendererDevUrl?: string;
  rendererDist: string;
  vitePublicPath: string;
}): void {
  let consoleWindow: BrowserWindow | null = null;

  ipcMain.handle('window:openConsole', () => {
    if (consoleWindow && !consoleWindow.isDestroyed()) {
      consoleWindow.show();
      consoleWindow.focus();
      return;
    }
    consoleWindow = createConsoleWindow(paths);
    consoleWindow.on('closed', () => { consoleWindow = null; });
  });

  ipcMain.handle('window:closeConsole', () => {
    if (consoleWindow && !consoleWindow.isDestroyed()) consoleWindow.close();
    consoleWindow = null;
  });
}
