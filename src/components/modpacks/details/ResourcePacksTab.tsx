
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { resourcePacksIPC } from '../../../services/ipc/resourcePacksIPC';
import type { ResourcePack } from '@shared/types/resourcePack';
import { Button } from '../../ui/Button';
import { LazyImage } from '../../ui/LazyImage';
import { cn } from '../../../utils/cn';

interface ResourcePacksTabProps {
    instancePath: string;
    onUpdate?: () => void;
    onAddResourcePack?: () => void;
}

export function ResourcePacksTab({ instancePath, onUpdate, onAddResourcePack }: ResourcePacksTabProps) {
    const { t } = useSettings();
    const [packs, setPacks] = useState<ResourcePack[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    // Load packs
    const loadPacks = useCallback(async () => {
        setLoading(true);
        try {
            const list = await resourcePacksIPC.list(instancePath);
            setPacks(list);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.resourcepack_load_error') || 'Failed to load resource packs');
        } finally {
            setLoading(false);
        }
    }, [instancePath, toast, t]);

    useEffect(() => {
        loadPacks();
    }, [loadPacks]);

    const handleToggle = async (pack: ResourcePack) => {
        try {
            if (pack.isEnabled) {
                await resourcePacksIPC.disable(pack.fileName, instancePath);
            } else {
                await resourcePacksIPC.enable(pack.fileName, instancePath);
            }
            await loadPacks();
            onUpdate?.();
        } catch {
            toast.error(t('modpacks.resourcepack_toggle_error') || 'Failed to toggle pack');
        }
    };

    const handleDelete = async (pack: ResourcePack) => {
        if (!confirm(t('modpacks.resourcepack_delete_confirm', { name: pack.name }) || `Delete ${pack.name}?`)) return;
        try {
            await resourcePacksIPC.delete(pack.fileName, instancePath);
            await loadPacks();
            onUpdate?.();
        } catch {
            toast.error(t('modpacks.resourcepack_delete_error') || 'Failed to delete pack');
        }
    };

    const handleMove = async (pack: ResourcePack, direction: 'up' | 'down') => {
        // UI list: Top = High Priority.
        // Array order in `packs` should reflect UI order.
        // We only reorder ENABLED packs.

        const enabledPacks = packs.filter(p => p.isEnabled);
        const currentIndex = enabledPacks.findIndex(p => p.fileName === pack.fileName);
        if (currentIndex === -1) return;

        const newPacks = [...enabledPacks];
        if (direction === 'up') {
            if (currentIndex === 0) return;
            [newPacks[currentIndex - 1], newPacks[currentIndex]] = [newPacks[currentIndex], newPacks[currentIndex - 1]];
        } else {
            if (currentIndex === enabledPacks.length - 1) return;
            [newPacks[currentIndex], newPacks[currentIndex + 1]] = [newPacks[currentIndex + 1], newPacks[currentIndex]];
        }

        // Send filenames in UI order (Top to Bottom)
        const fileNames = newPacks.map(p => p.fileName);

        try {
            await resourcePacksIPC.reorder(fileNames, instancePath);
            await loadPacks();
        } catch {
            toast.error(t('modpacks.resourcepack_reorder_error') || 'Failed to reorder packs');
        }
    };

    // Drag and drop logic can be complex, for now we stick to simple Up/Down buttons if list is not massive.
    // Or we can revisit Drag&Drop later.

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold dark:text-gray-200">{t('modpacks.installed_resourcepacks') || 'Installed Resource Packs'}</h3>
                <div className="flex gap-2">
                    {onAddResourcePack && (
                        <Button onClick={onAddResourcePack} variant="primary" size="sm">{t('modpacks.add_resourcepack_btn') || '+ Add Resource Pack'}</Button>
                    )}
                    <Button onClick={loadPacks} variant="secondary" size="sm">{t('modpacks.update') || 'Refresh'}</Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">{t('modpacks.loading') || 'Loading...'}</div>
            ) : packs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                    <p className="text-gray-500 mb-4">{t('modpacks.no_resourcepacks_installed') || 'No resource packs installed'}</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {packs.map((pack, index) => (
                        <div
                            key={pack.fileName}
                            className={cn(
                                "flex items-center gap-4 p-3 rounded-lg border transition-all",
                                pack.isEnabled
                                    ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm"
                                    : "bg-gray-50 dark:bg-zinc-900/50 border-transparent opacity-70 hover:opacity-100"
                            )}
                        >
                            <div className="w-12 h-12 flex-shrink-0">
                                <LazyImage
                                    src={pack.iconUrl}
                                    fallback="/icon.png" // default pack icon
                                    className={cn("w-full h-full object-cover rounded", !pack.isEnabled && "grayscale")}
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate text-gray-900 dark:text-gray-100">{pack.name}</h4>
                                <p className="text-xs text-gray-500 truncate">{pack.description || pack.fileName}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                {pack.isEnabled && (
                                    <div className="flex flex-col gap-1 mr-2">
                                        <button
                                            onClick={() => handleMove(pack, 'up')}
                                            disabled={index === 0 || !packs[index - 1].isEnabled} // Only move up if prev is enabled
                                            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            onClick={() => handleMove(pack, 'down')}
                                            disabled={index === packs.filter(p => p.isEnabled).length - 1}
                                            className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded disabled:opacity-30"
                                        >
                                            ▼
                                        </button>
                                    </div>
                                )}

                                <Button
                                    variant={pack.isEnabled ? "primary" : "secondary"}
                                    size="sm"
                                    onClick={() => handleToggle(pack)}
                                >
                                    {pack.isEnabled ? (t('modpacks.resourcepack_enable') || "Enabled") : (t('modpacks.resourcepack_disable') || "Disabled")}
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleDelete(pack)}
                                >
                                    ✕
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
