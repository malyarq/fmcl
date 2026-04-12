import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type {
    InstanceStatistics,
    PopularModpackStats,
    StatisticsExportPayload,
    StatisticsExportResult,
    StatisticsHistory,
    StatisticsOverview,
    StatisticsState,
    UsageTrendPoint,
} from '@shared/types/statistics';

function formatDayKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function cloneInstances(instances: InstanceStatistics): InstanceStatistics {
    return Object.fromEntries(
        Object.entries(instances).map(([instanceId, stats]) => [instanceId, { ...stats }]),
    );
}

function cloneHistory(history: StatisticsHistory): StatisticsHistory {
    return Object.fromEntries(
        Object.entries(history).map(([day, stats]) => [day, { ...stats }]),
    );
}

export class StatisticsService {
    private statsFile: string;
    private state: StatisticsState;

    constructor(statsFilePath?: string) {
        const userDataPath = statsFilePath ? undefined : app.getPath('userData');
        this.statsFile = statsFilePath ?? path.join(userDataPath as string, 'statistics.json');
        this.state = this.loadStats();
    }

    private getEmptyState(): StatisticsState {
        return {
            global: {
                totalPlayTime: 0,
                totalLaunches: 0,
            },
            instances: {},
            history: {},
        };
    }

    private normalizeStatsState(value: unknown): StatisticsState {
        if (!value || typeof value !== 'object') {
            return this.getEmptyState();
        }

        const candidate = value as Partial<StatisticsState>;
        return {
            global: {
                totalPlayTime: typeof candidate.global?.totalPlayTime === 'number' ? candidate.global.totalPlayTime : 0,
                totalLaunches: typeof candidate.global?.totalLaunches === 'number' ? candidate.global.totalLaunches : 0,
                lastPlayed: typeof candidate.global?.lastPlayed === 'number' ? candidate.global.lastPlayed : undefined,
            },
            instances: cloneInstances(candidate.instances ?? {}),
            history: cloneHistory(candidate.history ?? {}),
        };
    }

    private loadStats(): StatisticsState {
        try {
            if (fs.existsSync(this.statsFile)) {
                const data = fs.readFileSync(this.statsFile, 'utf-8');
                return this.normalizeStatsState(JSON.parse(data));
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
        return this.getEmptyState();
    }

    private saveStats() {
        try {
            fs.mkdirSync(path.dirname(this.statsFile), { recursive: true });
            fs.writeFileSync(this.statsFile, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('Failed to save statistics:', error);
        }
    }

    private getHistoryEntry(timestamp: number) {
        const day = formatDayKey(timestamp);
        if (!this.state.history[day]) {
            this.state.history[day] = {
                launches: 0,
                playTime: 0,
            };
        }

        return this.state.history[day];
    }

    private getPopularModpacks(): PopularModpackStats[] {
        return Object.entries(this.state.instances)
            .map(([instanceId, stats]) => ({
                instanceId,
                name: stats.name || instanceId,
                playTime: stats.playTime,
                launches: stats.launches,
                lastPlayed: stats.lastPlayed,
            }))
            .sort((left, right) =>
                right.playTime - left.playTime
                || right.launches - left.launches
                || right.lastPlayed - left.lastPlayed
                || left.name.localeCompare(right.name),
            );
    }

    private getUsageTrend(): UsageTrendPoint[] {
        return Object.entries(this.state.history)
            .map(([date, stats]) => ({
                date,
                launches: stats.launches,
                playTime: stats.playTime,
            }))
            .sort((left, right) => left.date.localeCompare(right.date));
    }

    private buildOverview(): StatisticsOverview {
        return {
            global: { ...this.state.global },
            instances: cloneInstances(this.state.instances),
            history: cloneHistory(this.state.history),
            popularModpacks: this.getPopularModpacks(),
            usageTrend: this.getUsageTrend(),
        };
    }

    public getStats(): StatisticsOverview {
        return this.buildOverview();
    }

    public exportStats(filePath: string): StatisticsExportResult {
        const payload: StatisticsExportPayload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            statistics: this.buildOverview(),
        };

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

        return {
            filePath,
            exportedAt: payload.exportedAt,
        };
    }

    public recordLaunch(instanceId?: string, name?: string) {
        const timestamp = Date.now();
        this.state.global.totalLaunches++;
        this.state.global.lastPlayed = timestamp;
        this.getHistoryEntry(timestamp).launches++;

        if (instanceId) {
            if (!this.state.instances[instanceId]) {
                this.state.instances[instanceId] = {
                    playTime: 0,
                    launches: 0,
                    lastPlayed: 0,
                    name: name,
                };
            }
            this.state.instances[instanceId].launches++;
            this.state.instances[instanceId].lastPlayed = timestamp;
            if (name) {
                this.state.instances[instanceId].name = name;
            }
        }

        this.saveStats();
    }

    public recordPlayTime(durationMs: number, instanceId?: string) {
        if (durationMs <= 0) return;

        this.state.global.totalPlayTime += durationMs;
        this.getHistoryEntry(Date.now()).playTime += durationMs;

        if (instanceId && this.state.instances[instanceId]) {
            this.state.instances[instanceId].playTime += durationMs;
        }

        this.saveStats();
    }
}
