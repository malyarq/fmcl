import { app, BrowserWindow } from 'electron';

export function registerLifecycleHandlers(params: {
  createWindow: () => void;
  shutdown: () => Promise<unknown>;
  terminationSignals?: Pick<NodeJS.Process, 'once' | 'off'>;
}) {
  const { createWindow, shutdown, terminationSignals = process } = params;
  let shutdownComplete = false;
  let shutdownPromise: Promise<unknown> | undefined;

  const requestSignalShutdown = () => {
    console.info('[Lifecycle] SIGTERM received');
    app.quit();
  };
  terminationSignals.once('SIGTERM', requestSignalShutdown);
  app.on('quit', () => terminationSignals.off('SIGTERM', requestSignalShutdown));

  app.on('before-quit', (event) => {
    if (shutdownComplete) return;
    event.preventDefault();
    console.info('[Lifecycle] Shutdown started');
    shutdownPromise ??= shutdown()
      .catch((error) => console.error('[Lifecycle] Shutdown failed:', error))
      .finally(() => {
        shutdownComplete = true;
        console.info('[Lifecycle] Shutdown complete');
        app.exit(0);
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
