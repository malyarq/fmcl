import { app, type BrowserWindow } from 'electron';

export function acquireApplicationInstance(rendererDevUrl?: string): boolean {
  if (rendererDevUrl?.includes(':5174')) {
    app.setPath('userData', `${app.getPath('userData')}_2`);
    return true;
  }
  return app.requestSingleInstanceLock();
}

export function focusExistingWindow(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
