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
import { AtomicJsonStore } from '../storage/atomicJsonStore';

function isStatisticsState(value: unknown): value is StatisticsState {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<StatisticsState>;
    return Boolean(candidate.global)
        && typeof candidate.global === 'object'
        && Boolean(candidate.instances)
        && typeof candidate.instances === 'object'
        && !Array.isArray(candidate.instances)
        && Boolean(candidate.history)
        && typeof candidate.history === 'object'
        && !Array.isArray(candidate.history);
}

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
    private statsStore: AtomicJsonStore<StatisticsState>;
    private state: StatisticsState;

    constructor(statsFilePath?: string) {
        const userDataPath = statsFilePath ? undefined : app.getPath('userData');
        this.statsFile = statsFilePath ?? path.join(userDataPath as string, 'statistics.json');
        this.statsStore = new AtomicJsonStore(this.statsFile, {
            version: 1,
            validate: isStatisticsState,
        });
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
        const loaded = this.statsStore.read();
        return loaded ? this.normalizeStatsState(loaded.value) : this.getEmptyState();
    }

    private commitState(state: StatisticsState): void {
        this.statsStore.write(state);
        this.state = state;
    }

    private cloneState(): StatisticsState {
        return {
            global: { ...this.state.global },
            instances: cloneInstances(this.state.instances),
            history: cloneHistory(this.state.history),
        };
    }

    private getHistoryEntry(state: StatisticsState, timestamp: number) {
        const day = formatDayKey(timestamp);
        if (!state.history[day]) {
            state.history[day] = {
                launches: 0,
                playTime: 0,
            };
        }

        return state.history[day];
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
        const nextState = this.cloneState();
        nextState.global.totalLaunches++;
        nextState.global.lastPlayed = timestamp;
        this.getHistoryEntry(nextState, timestamp).launches++;

        if (instanceId) {
            if (!nextState.instances[instanceId]) {
                nextState.instances[instanceId] = {
                    playTime: 0,
                    launches: 0,
                    lastPlayed: 0,
                    name: name,
                };
            }
            nextState.instances[instanceId].launches++;
            nextState.instances[instanceId].lastPlayed = timestamp;
            if (name) {
                nextState.instances[instanceId].name = name;
            }
        }

        this.commitState(nextState);
    }

    public recordPlayTime(durationMs: number, instanceId?: string) {
        if (durationMs <= 0) return;

        const nextState = this.cloneState();
        nextState.global.totalPlayTime += durationMs;
        this.getHistoryEntry(nextState, Date.now()).playTime += durationMs;

        if (instanceId && nextState.instances[instanceId]) {
            nextState.instances[instanceId].playTime += durationMs;
        }

        this.commitState(nextState);
    }
}
