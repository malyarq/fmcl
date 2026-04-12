import type {
    StatisticsExportResult,
    StatisticsOverview,
} from '../types/statistics';
export type { StatisticsExportPayload, StatisticsExportResult, StatisticsOverview, StatisticsState } from '../types/statistics';

export interface StatisticsAPI {
    getStats: () => Promise<StatisticsOverview>;
    exportStats: (filePath: string) => Promise<StatisticsExportResult>;
}
