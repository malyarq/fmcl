import { ipcRenderer } from 'electron';
import { SYSTEM_READINESS_CHANNELS, type SystemReadinessAPI } from '@shared/contracts';

export const systemReadiness: SystemReadinessAPI = {
  check: () => ipcRenderer.invoke(SYSTEM_READINESS_CHANNELS.check, {}),
};
