import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import { ModpacksIPC } from '../../../services/ipc/modpacksIPC';
import { formatSize } from '../../../utils/format';
import { cn } from '../../../utils/cn';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

interface StorageStats {
    totalSize: number;
    dedupedSize: number;
    totalFiles: number;
    storedFiles: number;
}

interface StorageSettingsProps {
    t: (key: string) => string;
    getAccentStyles: (type: 'bg' | 'text' | 'border') => { className?: string; style?: React.CSSProperties };
    modpacksIPC: ModpacksIPC;
    embedded?: boolean;
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({ t, getAccentStyles, modpacksIPC, embedded = false }) => {
    const confirm = useConfirm();
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<{ freedSize: number; deletedFiles: number } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const data = await modpacksIPC.getContentStats();
            setStats(data);
            setError(null);
        } catch (error) {
            console.error('Failed to load storage stats:', error);
            setError(error instanceof Error ? error.message : t('settings.storage.loadError'));
        } finally {
            setLoading(false);
        }
    }, [modpacksIPC, t]);

    useEffect(() => {
        void loadStats();
    }, [loadStats]);

    const handleCleanup = async () => {
        const confirmed = await confirm.confirm({
            title: t('settings.storage.cleanupTitle'),
            message: t('settings.storage.cleanupConfirm'),
            confirmText: t('settings.storage.cleanupConfirmButton'),
            cancelText: t('general.cancel'),
            variant: 'danger',
        });

        if (!confirmed) {
            return;
        }

        setLoading(true);
        try {
            const result = await modpacksIPC.cleanupContent();
            setCleanupResult(result);
            setError(null);
            await loadStats();
        } catch (error) {
            console.error('Failed to cleanup content:', error);
            setError(error instanceof Error ? error.message : t('settings.storage.cleanupError'));
        } finally {
            setLoading(false);
        }
    };

    if (loading && !stats) {
        return (
            <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                <LoadingSpinner size="sm" variant="accent" />
                {t('settings.storage.loading')}
            </div>
        );
    }

    return (
        <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-4">
                {!embedded && (
                    <div className="settings-section-shell settings-section-copy p-5">
                        <div className="kicker-label">{t('settings.storage.title')}</div>
                        <h3 className="text-lg font-bold text-foreground">{t('settings.storage.title')}</h3>
                        <p className="settings-embedded-copy">{t('settings.storage.description')}</p>
                    </div>
                )}

                <div className="settings-section-shell settings-section-stack p-5">
                    {error && (
                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="settings-section-copy">
                        <h4 className="settings-embedded-title">
                            {t('settings.storage.cleanup')}
                        </h4>
                        <p className="settings-embedded-copy">
                            {t('settings.storage.cleanupDesc')}
                        </p>
                    </div>

                    <Button
                        variant="secondary"
                        onClick={() => void handleCleanup()}
                        disabled={loading}
                        isLoading={loading}
                        className="sm:w-fit"
                    >
                        {t('settings.storage.cleanupBtn')}
                    </Button>

                    {cleanupResult && (
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                            {t('settings.storage.cleanupResult')
                                .replace('{size}', formatSize(cleanupResult.freedSize))
                                .replace('{count}', cleanupResult.deletedFiles.toString())}
                        </div>
                    )}
                </div>
            </div>

            {stats && (
                <div className="settings-stat-grid">
                    <div className="settings-stat-card">
                        <div className="mb-1 text-sm text-secondary">
                            {t('settings.storage.totalSize')}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {formatSize(stats.totalSize)}
                        </div>
                    </div>

                    <div className="settings-stat-card">
                        <div className="mb-1 text-sm text-secondary">
                            {t('settings.storage.savedSize')}
                        </div>
                        <div
                            className={cn("text-2xl font-bold", getAccentStyles('text').className)}
                            style={getAccentStyles('text').style}
                        >
                            {formatSize(stats.dedupedSize)}
                        </div>
                    </div>

                    <div className="settings-stat-card">
                        <div className="mb-1 text-sm text-secondary">
                            {t('settings.storage.storedFiles')}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {stats.storedFiles}
                        </div>
                    </div>

                    <div className="settings-stat-card">
                        <div className="mb-1 text-sm text-secondary">
                            {t('settings.storage.totalLogicalFiles')}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {stats.totalFiles}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
