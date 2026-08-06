import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../../ui/Button';
import type { StorageMaintenanceStats } from '@shared/contracts';
import type { StorageMaintenanceIPC } from '../../../services/ipc/storageMaintenanceIPC';
import { formatSize } from '../../../utils/format';
import { cn } from '../../../utils/cn';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { settingsIPC } from '../../../services/ipc/settingsIPC';
import { applySettingsBackup, collectSettingsBackup } from '../../../features/settings/backup/settingsBackup';
import { analyticsClient } from '../../../features/analytics/analyticsClient';

interface StorageSettingsProps {
    t: (key: string) => string;
    getAccentStyles: (type: 'bg' | 'text' | 'border') => { className?: string; style?: React.CSSProperties };
    storageMaintenanceIPC: StorageMaintenanceIPC;
    embedded?: boolean;
}

export const StorageSettings: React.FC<StorageSettingsProps> = ({ t, getAccentStyles, storageMaintenanceIPC, embedded = false }) => {
    const confirm = useConfirm();
    const [stats, setStats] = useState<StorageMaintenanceStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [cleanupResult, setCleanupResult] = useState<{ freedSize: number; deletedFiles: number } | null>(null);
    const [backupMessage, setBackupMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const cleanupSectionClassName = embedded
        ? 'surface-muted settings-section-stack p-5'
        : 'settings-section-shell settings-section-stack p-5';
    const statsSectionClassName = embedded
        ? 'surface-muted min-w-0 p-5'
        : 'settings-section-shell min-w-0 p-5';
    const storageStatClassName = 'rounded-[18px] border border-border/60 bg-card/56 p-4 text-foreground';

    const loadStats = useCallback(async () => {
        setLoading(true);
        try {
            const data = await storageMaintenanceIPC.getStats();
            setStats(data);
            setError(null);
        } catch (error) {
            console.error('Failed to load storage stats:', error);
            setError(error instanceof Error ? error.message : t('settings.storage.loadError'));
        } finally {
            setLoading(false);
        }
    }, [storageMaintenanceIPC, t]);

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
            const result = await storageMaintenanceIPC.cleanup();
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

    const handleExportSettings = async () => {
        setLoading(true);
        setBackupMessage(null);
        setError(null);
        try {
            const result = await settingsIPC.exportBackup(collectSettingsBackup());
            if (!result.canceled) {
                setBackupMessage(t('settings.storage.backupExported').replace('{file}', result.fileName ?? ''));
                void analyticsClient.capture('settings_backup_exported', {});
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t('settings.storage.backupError'));
        } finally {
            setLoading(false);
        }
    };

    const handleImportSettings = async () => {
        setLoading(true);
        setBackupMessage(null);
        setError(null);
        try {
            const result = await settingsIPC.importBackup();
            if (result.canceled || !result.values) return;
            const confirmed = await confirm.confirm({
                title: t('settings.storage.backupImportTitle'),
                message: t('settings.storage.backupImportConfirm'),
                confirmText: t('settings.storage.backupImportButton'),
                cancelText: t('general.cancel'),
            });
            if (!confirmed) return;
            applySettingsBackup(result.values);
            setError(null);
            setBackupMessage(t('settings.storage.backupImported').replace('{file}', result.fileName ?? ''));
            void analyticsClient.capture('settings_backup_imported', {});
            window.setTimeout(() => window.location.reload(), 400);
        } catch (error) {
            setError(error instanceof Error ? error.message : t('settings.storage.backupError'));
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <div className="min-w-0 space-y-4">
                {!embedded && (
                    <div className="settings-section-shell settings-section-copy p-5">
                        <div className="kicker-label">{t('settings.storage.title')}</div>
                        <h3 className="text-lg font-bold text-foreground">{t('settings.storage.title')}</h3>
                        <p className="settings-embedded-copy">{t('settings.storage.description')}</p>
                    </div>
                )}

                <div className={cleanupSectionClassName}>
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

                <div className={cleanupSectionClassName}>
                    <div className="settings-section-copy">
                        <h4 className="settings-embedded-title">{t('settings.storage.backup')}</h4>
                        <p className="settings-embedded-copy">{t('settings.storage.backupDesc')}</p>
                        <p className="text-xs leading-5 text-muted">{t('settings.storage.backupPrivacy')}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="secondary" onClick={() => void handleExportSettings()} disabled={loading}>
                            {t('settings.storage.backupExport')}
                        </Button>
                        <Button variant="ghost" onClick={() => void handleImportSettings()} disabled={loading}>
                            {t('settings.storage.backupImport')}
                        </Button>
                    </div>
                    {backupMessage && <p className="text-sm text-emerald-300" role="status">{backupMessage}</p>}
                </div>
            </div>

            {stats && (
                <div className={statsSectionClassName}>
                    <div className="settings-stat-grid">
                        <div className={storageStatClassName}>
                            <div className="mb-1 text-sm text-secondary">
                                {t('settings.storage.totalSize')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                                {formatSize(stats.totalSize)}
                            </div>
                        </div>

                        <div className={storageStatClassName}>
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

                        <div className={storageStatClassName}>
                            <div className="mb-1 text-sm text-secondary">
                                {t('settings.storage.storedFiles')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                                {stats.storedFiles}
                            </div>
                        </div>

                        <div className={storageStatClassName}>
                            <div className="mb-1 text-sm text-secondary">
                                {t('settings.storage.totalLogicalFiles')}
                            </div>
                            <div className="text-2xl font-bold text-foreground">
                                {stats.totalFiles}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
