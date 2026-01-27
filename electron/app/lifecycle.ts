import { app, BrowserWindow } from 'electron';

export function registerLifecycleHandlers(params: {
  createWindow: () => void;
}) {
  const { createWindow } = params;

  // Quit when all windows are closed, except on macOS.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On macOS it's common to re-create a window when dock icon clicked.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}

