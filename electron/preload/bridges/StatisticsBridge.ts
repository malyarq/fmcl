import { ipcRenderer } from 'electron';
import type { StatisticsAPI } from '@shared/contracts/statistics';

export const statistics: StatisticsAPI = {
    getStats: async () => ipcRenderer.invoke('stats:get'),
    exportStats: async (filePath) => ipcRenderer.invoke('stats:export', filePath),
};
