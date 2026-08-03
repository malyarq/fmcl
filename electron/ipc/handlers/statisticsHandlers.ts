import { ipcMain } from 'electron';
import { StatisticsService } from '../../services/stats/statisticsService';
import { validateFilesystemPath } from '../validation/privilegedPayloads';
import { consumeAuthorizedSavePath } from '../../security/savePathAuthorizations';

export function registerStatisticsHandlers({ statisticsService }: { statisticsService: StatisticsService }) {
    ipcMain.handle('stats:get', async () => {
        return statisticsService.getStats();
    });

    ipcMain.handle('stats:export', async (event, filePath: unknown) => {
        const validatedPath = validateFilesystemPath(filePath, 'Statistics export path');
        if (!validatedPath) {
            throw new Error('Statistics export path is required.');
        }
        const safeFilePath = consumeAuthorizedSavePath(event.sender.id, validatedPath);

        return statisticsService.exportStats(safeFilePath);
    });
}
