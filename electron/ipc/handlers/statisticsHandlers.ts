import { ipcMain } from 'electron';
import { StatisticsService } from '../../services/stats/statisticsService';
import { validateFilesystemPath } from '../validation/privilegedPayloads';

export function registerStatisticsHandlers({ statisticsService }: { statisticsService: StatisticsService }) {
    ipcMain.handle('stats:get', async () => {
        return statisticsService.getStats();
    });

    ipcMain.handle('stats:export', async (_event, filePath: unknown) => {
        const safeFilePath = validateFilesystemPath(filePath, 'Statistics export path');
        if (!safeFilePath) {
            throw new Error('Statistics export path is required.');
        }

        return statisticsService.exportStats(safeFilePath);
    });
}
