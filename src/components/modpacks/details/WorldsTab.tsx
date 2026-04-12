import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { worldsIPC, openWorldFolder } from '../../../services/ipc/worldsIPC';
import type { WorldInfo } from '@shared/contracts/worlds';
import { Button } from '../../ui/Button';

interface WorldsTabProps {
    instancePath: string;
    mcVersion?: string;
    onUpdate?: () => void;
}

/** Check if MC version supports datapacks (1.13+) */
function supportsDatapacks(version?: string): boolean {
    if (!version) return true; // If unknown, allow
    const match = version.match(/^1\.(\d+)/);
    if (!match) return true;
    const minor = parseInt(match[1], 10);
    return minor >= 13;
}

import { formatSize, formatDate } from '../../../utils/format';

import { WorldDatapacksModal } from './WorldDatapacksModal';

export function WorldsTab({ instancePath, mcVersion, onUpdate }: WorldsTabProps) {
    const { t } = useSettings();
    const [worlds, setWorlds] = useState<WorldInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    // Datapacks Modal State
    const [datapacksModalWorld, setDatapacksModalWorld] = useState<WorldInfo | null>(null);

    // Load worlds
    const loadWorlds = useCallback(async () => {
        setLoading(true);
        try {
            const list = await worldsIPC.list(instancePath);
            setWorlds(list);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.world_load_error') || 'Failed to load worlds');
        } finally {
            setLoading(false);
        }
    }, [instancePath, toast, t]);

    useEffect(() => {
        loadWorlds();
    }, [loadWorlds]);

    const handleBackup = async (world: WorldInfo) => {
        try {
            const backupPath = await worldsIPC.backup(world.folderName, instancePath);
            const fileName = backupPath.split(/[/\\]/).pop() || 'backup';
            toast.success(t('modpacks.world_backup_success', { file: fileName }) || `Backup created: ${fileName}`);
        } catch {
            toast.error(t('modpacks.world_backup_error') || 'Failed to create backup');
        }
    };

    const handleDuplicate = async (world: WorldInfo) => {
        try {
            const newName = await worldsIPC.duplicate(world.folderName, instancePath);
            await loadWorlds();
            onUpdate?.();
            toast.success(t('modpacks.world_duplicate_success', { name: newName }) || `World duplicated as "${newName}"`);
        } catch {
            toast.error(t('modpacks.world_duplicate_error') || 'Failed to duplicate world');
        }
    };

    const handleDelete = async (world: WorldInfo) => {
        if (!confirm(t('modpacks.world_delete_confirm', { name: world.name }) || `Delete world "${world.name}"? This cannot be undone!`)) return;
        try {
            await worldsIPC.delete(world.folderName, instancePath);
            await loadWorlds();
            onUpdate?.();
            toast.success(t('modpacks.world_delete_success') || 'World deleted');
        } catch {
            toast.error(t('modpacks.world_delete_error') || 'Failed to delete world');
        }
    };

    const handleOpenFolder = (world: WorldInfo) => {
        openWorldFolder(world.folderName, instancePath);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold dark:text-gray-200">{t('modpacks.saved_worlds') || 'Saved Worlds'}</h3>
                <Button onClick={loadWorlds} variant="secondary" size="sm">{t('modpacks.world_refresh') || 'Refresh'}</Button>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">{t('modpacks.loading') || 'Loading...'}</div>
            ) : worlds.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                    <p className="text-gray-500 mb-2">{t('modpacks.no_worlds_found') || 'No worlds found'}</p>
                    <p className="text-gray-400 text-sm">{t('modpacks.play_to_create_world') || 'Play the game to create your first world!'}</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {worlds.map((world) => (
                        <div
                            key={world.folderName}
                            className="flex items-center gap-4 p-3 rounded-lg border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm"
                        >
                            <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white text-2xl">
                                🌍
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate text-gray-900 dark:text-gray-100">{world.name}</h4>
                                <div className="flex gap-3 text-xs text-gray-500">
                                    <span>{formatSize(world.sizeBytes)}</span>
                                    <span>{t('modpacks.last_played', { date: formatDate(world.lastPlayed, t('general.unknown')) }) || `Last played: ${formatDate(world.lastPlayed, 'Unknown')}`}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                {supportsDatapacks(mcVersion) && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setDatapacksModalWorld(world)}
                                        title={t('modpacks.manage_datapacks') || 'Manage Datapacks'}
                                        className="mr-2"
                                    >
                                        📦 {t('modpacks.datapacks') || 'Datapacks'}
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenFolder(world)}
                                    title={t('settings.open_folder') || 'Open folder'}
                                >
                                    📁
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleBackup(world)}
                                    title={t('modpacks.backup') || 'Backup'}
                                >
                                    💾
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDuplicate(world)}
                                    title={t('modpacks.duplicate') || 'Duplicate'}
                                >
                                    📋
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleDelete(world)}
                                    title={t('modpacks.delete') || 'Delete'}
                                >
                                    ✕
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {datapacksModalWorld && (
                <WorldDatapacksModal
                    isOpen={!!datapacksModalWorld}
                    onClose={() => setDatapacksModalWorld(null)}
                    instancePath={instancePath}
                    worldFolder={datapacksModalWorld.folderName}
                    worldName={datapacksModalWorld.name}
                />
            )}
        </div>
    );
}
