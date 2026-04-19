import { useCallback, useEffect, useState } from 'react';
import { Archive, Copy, FolderOpen, Globe2, Package, RefreshCw, Trash2 } from 'lucide-react';
import type { WorldInfo } from '@shared/contracts/worlds';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { openWorldFolder, worldsIPC } from '../../../services/ipc/worldsIPC';
import { formatSize } from '../../../utils/format';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { WorldDatapacksModal } from './WorldDatapacksModal';
import { DegradedStateView } from '../../layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../../utils/displayError';

interface WorldsTabProps {
    instancePath: string;
    mcVersion?: string;
    onUpdate?: () => void;
}

function supportsDatapacks(version?: string): boolean {
    if (!version) {
        return true;
    }

    const match = version.match(/^1\.(\d+)/);
    if (!match) {
        return true;
    }

    return Number.parseInt(match[1], 10) >= 13;
}

export function WorldsTab({ instancePath, mcVersion, onUpdate }: WorldsTabProps) {
    const { t, formatDate, formatNumber } = useSettings();
    const confirm = useConfirm();
    const [worlds, setWorlds] = useState<WorldInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown | null>(null);
    const [datapacksModalWorld, setDatapacksModalWorld] = useState<WorldInfo | null>(null);
    const toast = useToast();

    const loadWorlds = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const list = await worldsIPC.list(instancePath);
            setWorlds(list);
        } catch (err) {
            console.error(err);
            setLoadError(err);
            toast.error(t('modpacks.world_load_error'));
        } finally {
            setLoading(false);
        }
    }, [instancePath, t, toast]);
    const worldsLoadDescription = loadError
        ? toDisplayErrorMessage(loadError, t('error.inline_fallback'))
        : t('error.inline_fallback');

    useEffect(() => {
        void loadWorlds();
    }, [loadWorlds]);

    const handleBackup = useCallback(
        async (world: WorldInfo) => {
            try {
                const backupPath = await worldsIPC.backup(world.folderName, instancePath);
                const fileName = backupPath.split(/[/\\]/).pop() || 'backup';
                toast.success(t('modpacks.world_backup_success', { file: fileName }));
            } catch {
                toast.error(t('modpacks.world_backup_error'));
            }
        },
        [instancePath, t, toast]
    );

    const handleDuplicate = useCallback(
        async (world: WorldInfo) => {
            try {
                const newName = await worldsIPC.duplicate(world.folderName, instancePath);
                await loadWorlds();
                onUpdate?.();
                toast.success(t('modpacks.world_duplicate_success', { name: newName }));
            } catch {
                toast.error(t('modpacks.world_duplicate_error'));
            }
        },
        [instancePath, loadWorlds, onUpdate, t, toast]
    );

    const handleDelete = useCallback(
        async (world: WorldInfo) => {
            const confirmed = await confirm.confirm({
                title: t('modpacks.saved_worlds'),
                message: t('modpacks.world_delete_confirm', { name: world.name }),
                variant: 'danger',
                confirmText: t('modpacks.delete'),
                cancelText: t('general.cancel'),
            });

            if (!confirmed) {
                return;
            }

            try {
                await worldsIPC.delete(world.folderName, instancePath);
                await loadWorlds();
                onUpdate?.();
                toast.success(t('modpacks.world_delete_success'));
            } catch {
                toast.error(t('modpacks.world_delete_error'));
            }
        },
        [confirm, instancePath, loadWorlds, onUpdate, t, toast]
    );

    return (
        <div className="space-y-4">
            <div className="surface-card space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="kicker-label">{t('modpacks.tab_worlds')}</div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">{t('modpacks.saved_worlds')}</h3>
                            <p className="text-sm text-secondary">{t('modpacks.worlds_description')}</p>
                        </div>
                    </div>
                    <Button onClick={() => void loadWorlds()} variant="secondary" size="sm">
                        <RefreshCw className="h-4 w-4" />
                        {t('modpacks.world_refresh')}
                    </Button>
                </div>

                <div className="surface-inline flex flex-wrap items-center gap-3 p-3 text-sm text-secondary">
                    <span>{t('modpacks.worlds_manage_hint')}</span>
                    <span className="text-foreground">{loadError ? t('degraded.unavailable_label') : formatNumber(worlds.length)}</span>
                </div>
            </div>

            {loading ? (
                <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                    <LoadingSpinner size="sm" variant="accent" />
                    {t('modpacks.loading')}
                </div>
            ) : loadError ? (
                <DegradedStateView
                    variant="unavailable"
                    label={t('degraded.unavailable_label')}
                    title={t('modpacks.world_load_error')}
                    description={worldsLoadDescription}
                    footer={(
                        <Button variant="secondary" size="sm" onClick={() => void loadWorlds()}>
                            <RefreshCw className="h-4 w-4" />
                            {t('modpacks.world_refresh')}
                        </Button>
                    )}
                />
            ) : worlds.length === 0 ? (
                <DegradedStateView
                    variant="empty"
                    label={t('degraded.empty_label')}
                    title={t('modpacks.no_worlds_found')}
                    description={t('modpacks.play_to_create_world')}
                />
            ) : (
                <div className="space-y-3" role="list" aria-label={t('modpacks.saved_worlds')}>
                    {worlds.map((world) => (
                        <div
                            key={world.folderName}
                            role="listitem"
                            className="surface-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-[rgb(var(--accent-main))]">
                                    <Globe2 className="h-6 w-6" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <h4 className="truncate text-base font-semibold text-foreground">{world.name}</h4>
                                    <div className="flex flex-wrap gap-3 text-sm text-secondary">
                                        <span>{formatSize(world.sizeBytes)}</span>
                                        <span>{t('modpacks.last_played', { date: formatDate(world.lastPlayed, t('general.unknown'), { dateStyle: 'medium' }) })}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                {supportsDatapacks(mcVersion) && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setDatapacksModalWorld(world)}
                                    >
                                        <Package className="h-4 w-4" />
                                        {t('modpacks.datapacks')}
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => openWorldFolder(world.folderName, instancePath)}>
                                    <FolderOpen className="h-4 w-4" />
                                    {t('settings.open_folder')}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => void handleBackup(world)}>
                                    <Archive className="h-4 w-4" />
                                    {t('modpacks.backup')}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => void handleDuplicate(world)}>
                                    <Copy className="h-4 w-4" />
                                    {t('modpacks.duplicate')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => void handleDelete(world)}
                                    aria-label={t('modpacks.world_delete_confirm', { name: world.name })}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {datapacksModalWorld && (
                <WorldDatapacksModal
                    isOpen={Boolean(datapacksModalWorld)}
                    onClose={() => setDatapacksModalWorld(null)}
                    instancePath={instancePath}
                    worldFolder={datapacksModalWorld.folderName}
                    worldName={datapacksModalWorld.name}
                />
            )}
        </div>
    );
}
