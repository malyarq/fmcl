import { app, BrowserWindow } from 'electron';

export function registerLifecycleHandlers(params: {
  createWindow: () => void;
  shutdown: () => Promise<unknown>;
}) {
  const { createWindow, shutdown } = params;
  let shutdownComplete = false;
  let shutdownPromise: Promise<unknown> | undefined;

  app.on('before-quit', (event) => {
    if (shutdownComplete) return;
    event.preventDefault();
    shutdownPromise ??= shutdown()
      .catch((error) => console.error('[Lifecycle] Shutdown failed:', error))
      .finally(() => {
        shutdownComplete = true;
        app.quit();
      });
  });

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
