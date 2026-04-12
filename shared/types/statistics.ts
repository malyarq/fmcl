export interface GlobalStatistics {
    totalPlayTime: number; // in milliseconds
    totalLaunches: number;
    lastPlayed?: number; // timestamp
}

export interface StatisticsHistoryEntry {
    launches: number;
    playTime: number;
}

export interface StatisticsHistory {
    [day: string]: StatisticsHistoryEntry;
}

export interface InstanceStatistics {
    [instanceId: string]: {
        name?: string;
        playTime: number;
        launches: number;
        lastPlayed: number;
    };
}

export interface StatisticsState {
    global: GlobalStatistics;
    instances: InstanceStatistics;
    history: StatisticsHistory;
}

export interface PopularModpackStats {
    instanceId: string;
    name: string;
    playTime: number;
    launches: number;
    lastPlayed: number;
}

export interface UsageTrendPoint {
    date: string;
    launches: number;
    playTime: number;
}

export interface StatisticsOverview extends StatisticsState {
    popularModpacks: PopularModpackStats[];
    usageTrend: UsageTrendPoint[];
}

export interface StatisticsExportPayload {
    version: 1;
    exportedAt: string;
    statistics: StatisticsOverview;
}

export interface StatisticsExportResult {
    filePath: string;
    exportedAt: string;
}
