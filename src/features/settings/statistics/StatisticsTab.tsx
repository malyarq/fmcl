import React, { useCallback, useEffect, useState } from 'react';
import type { StatisticsOverview } from '@shared/contracts/statistics';
import { Download } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { dialogIPC } from '../../../services/ipc/dialogIPC';
import { statisticsIPC } from '../../../services/ipc/statisticsIPC';

function formatTime(ms: number): string {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    return `${hours}h ${minutes}m ${seconds}s`;
}

function formatTrendDate(date: string): string {
    const value = new Date(`${date}T00:00:00`);
    return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const StatisticsTab: React.FC = () => {
    const { t } = useSettings();
    const toast = useToast();
    const [stats, setStats] = useState<StatisticsOverview | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const loadStats = useCallback(async () => {
        try {
            const data = await statisticsIPC.getStats();
            setStats(data);
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }, []);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    const handleExport = async () => {
        setIsExporting(true);

        try {
            const result = await dialogIPC.showSaveDialog({
                title: t('stats.export'),
                defaultPath: `fmcl-statistics-${new Date().toISOString().slice(0, 10)}.json`,
                filters: [{ name: 'JSON', extensions: ['json'] }],
            });

            if (result.canceled || !result.filePath) {
                return;
            }

            await statisticsIPC.exportStats(result.filePath);
            toast.success(t('stats.exportSuccess'));
        } catch (error) {
            console.error('Failed to export statistics:', error);
            toast.error(t('stats.exportError'));
        } finally {
            setIsExporting(false);
        }
    };

    if (!stats) {
        return (
            <div role="status" className="surface-inline flex items-center justify-center gap-3 p-4 text-center text-secondary">
                <LoadingSpinner size="sm" variant="accent" />
                {t('stats.loading')}
            </div>
        );
    }

    const averageSessionTime = stats.global.totalLaunches > 0
        ? Math.round(stats.global.totalPlayTime / stats.global.totalLaunches)
        : 0;
    const trendPoints = stats.usageTrend.slice(-7);
    const maxTrendLaunches = Math.max(1, ...trendPoints.map((point) => point.launches));
    const maxTrendPlayTime = Math.max(1, ...trendPoints.map((point) => point.playTime));

    return (
        <div className="space-y-4">
            <div className="surface-card flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                    <div className="kicker-label">{t('settings.tab_statistics')}</div>
                    <h3 className="text-lg font-bold text-foreground">{t('stats.global_stats')}</h3>
                    <p className="text-sm text-secondary">{t('stats.description')}</p>
                </div>
                <Button
                    onClick={() => void handleExport()}
                    isLoading={isExporting}
                    disabled={isExporting}
                    className="gap-2 md:self-start"
                >
                    <Download size={16} />
                    {isExporting ? t('stats.exporting') : t('stats.export')}
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="surface-card p-4">
                    <div className="text-sm text-secondary">{t('stats.total_play_time')}</div>
                    <div className="text-2xl font-bold text-foreground">{formatTime(stats.global.totalPlayTime)}</div>
                </div>
                <div className="surface-card p-4">
                    <div className="text-sm text-secondary">{t('stats.total_launches')}</div>
                    <div className="text-2xl font-bold text-foreground">{stats.global.totalLaunches}</div>
                </div>
                <div className="surface-card p-4">
                    <div className="text-sm text-secondary">{t('stats.average_session')}</div>
                    <div className="text-2xl font-bold text-foreground">{formatTime(averageSessionTime)}</div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="surface-card space-y-3 p-4">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{t('stats.popular_modpacks')}</h4>
                        <p className="text-sm text-secondary">{t('stats.description')}</p>
                    </div>

                    <div className="space-y-2" role="list" aria-label={t('stats.popular_modpacks')}>
                        {stats.popularModpacks.slice(0, 5).map((modpack, index) => (
                            <div
                                key={modpack.instanceId}
                                role="listitem"
                                className="surface-muted flex items-center justify-between gap-4 p-3"
                            >
                                <div>
                                    <div className="font-medium text-foreground">
                                        {index + 1}. {modpack.name}
                                    </div>
                                    <div className="text-xs text-secondary">
                                        {t('stats.launches')}: {modpack.launches}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono text-foreground">{formatTime(modpack.playTime)}</div>
                                    <div className="text-xs text-secondary">
                                        {t('stats.last_played')}: {modpack.lastPlayed ? new Date(modpack.lastPlayed).toLocaleDateString() : '—'}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {stats.popularModpacks.length === 0 && (
                            <div className="surface-inline py-4 text-center text-secondary">{t('stats.no_popular_modpacks')}</div>
                        )}
                    </div>
                </div>

                <div className="surface-card space-y-3 p-4">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">{t('stats.usage_trend')}</h4>
                        <p className="text-sm text-secondary">{t('stats.description')}</p>
                    </div>

                    <div className="space-y-3" role="list" aria-label={t('stats.usage_trend')}>
                        {trendPoints.map((point) => (
                            <div key={point.date} role="listitem" className="surface-muted space-y-2 p-3">
                                <div className="flex items-center justify-between text-sm text-foreground">
                                    <span>{formatTrendDate(point.date)}</span>
                                    <span>
                                        {point.launches} {t('stats.trend_launches')} · {formatTime(point.playTime)}
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <div className="mb-1 flex justify-between text-xs text-secondary">
                                            <span>{t('stats.trend_launches')}</span>
                                            <span>{point.launches}</span>
                                        </div>
                                        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-background/80">
                                            <div
                                                className="h-full rounded-full bg-emerald-500"
                                                style={{ width: `${(point.launches / maxTrendLaunches) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="mb-1 flex justify-between text-xs text-secondary">
                                            <span>{t('stats.trend_play_time')}</span>
                                            <span>{formatTime(point.playTime)}</span>
                                        </div>
                                        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-background/80">
                                            <div
                                                className="h-full rounded-full bg-blue-500"
                                                style={{ width: `${(point.playTime / maxTrendPlayTime) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {trendPoints.length === 0 && (
                            <div className="surface-inline py-4 text-center text-secondary">{t('stats.no_usage_trend')}</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="surface-card space-y-3 p-4">
                <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">{t('stats.instance_stats')}</h4>
                    <p className="text-sm text-secondary">{t('stats.description')}</p>
                </div>

                <div className="space-y-2" role="list" aria-label={t('stats.instance_stats')}>
                    {Object.entries(stats.instances).map(([id, instance]) => (
                        <div key={id} role="listitem" className="surface-muted flex items-center justify-between gap-4 p-3">
                            <div>
                                <div className="font-medium text-foreground">{instance.name || id}</div>
                                <div className="text-xs text-secondary">
                                    {t('stats.launches')}: {instance.launches}
                                </div>
                            </div>
                            <div className="font-mono text-foreground">
                                {formatTime(instance.playTime)}
                            </div>
                        </div>
                    ))}
                    {Object.keys(stats.instances).length === 0 && (
                        <div className="surface-inline py-4 text-center text-secondary">{t('stats.no_instance_stats')}</div>
                    )}
                </div>
            </div>
        </div>
    );
};
