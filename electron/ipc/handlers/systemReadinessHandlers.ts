import { ipcMain } from 'electron';
import { SYSTEM_READINESS_CHANNELS, type SystemReadinessReport } from '../../../shared/contracts/systemReadiness';

export function registerSystemReadinessHandlers(check: () => Promise<SystemReadinessReport>): void {
  ipcMain.removeHandler(SYSTEM_READINESS_CHANNELS.check);
  ipcMain.handle(SYSTEM_READINESS_CHANNELS.check, async (_event, request: unknown) => {
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).length !== 0) {
      throw new Error('System readiness request must be an empty object.');
    }
    return await check();
  });
}
