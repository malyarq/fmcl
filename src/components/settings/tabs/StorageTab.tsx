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
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({ t, getAccentStyles, modpacksIPC }) => {
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
        <div className="space-y-4">
            <div className="surface-card space-y-2 p-4">
                <div className="kicker-label">{t('settings.tab_storage')}</div>
                <h3 className="text-lg font-bold text-foreground">{t('settings.storage.title')}</h3>
                <p className="text-sm text-secondary">{t('settings.storage.description')}</p>
            </div>

            {stats && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="surface-card p-4">
                        <div className="mb-1 text-sm text-secondary">
                            {t('settings.storage.totalSize')}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {formatSize(stats.totalSize)}
                        </div>
                    </div>

                    <div className="surface-card p-4">
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

                    <div className="surface-card p-4">
                        <div className="mb-1 text-sm text-secondary">
                            {t('settings.storage.storedFiles')}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {stats.storedFiles}
                        </div>
                    </div>

                    <div className="surface-card p-4">
                        <div className="mb-1 text-sm text-secondary">
                            {t('settings.storage.totalLogicalFiles')}
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {stats.totalFiles}
                        </div>
                    </div>
                </div>
            )}

            <div className="surface-inline space-y-4 p-4">
                {error && (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">
                            {t('settings.storage.cleanup')}
                        </h4>
                        <p className="text-sm text-secondary">
                            {t('settings.storage.cleanupDesc')}
                        </p>
                    </div>

                    <Button
                        variant="secondary"
                        onClick={() => void handleCleanup()}
                        disabled={loading}
                        isLoading={loading}
                    >
                        {t('settings.storage.cleanupBtn')}
                    </Button>
                </div>

                {cleanupResult && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                        {t('settings.storage.cleanupResult')
                            .replace('{size}', formatSize(cleanupResult.freedSize))
                            .replace('{count}', cleanupResult.deletedFiles.toString())}
                    </div>
                )}
            </div>
        </div>
    );
};
