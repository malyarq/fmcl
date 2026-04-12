import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { modpacksIPC } from '../../../services/ipc/modpacksIPC';
import { Button } from '../../ui/Button';
import { AddModModal } from '../AddModModal';
import { cn } from '../../../utils/cn';
import { modNameToSlug } from '../../../utils/modSlug';
import { externalLinksIPC } from '../../../services/ipc/externalLinksIPC';

export interface ModsTabProps {
    modpackId: string;
    instancePath?: string;
    showAddButton?: boolean;
    defaultMCVersion?: string;
    defaultLoader?: string;
    onUpdate?: () => void;
    // This prop allows optional accent styling similar to other tabs if needed, 
    // though we mostly rely on standardized UI components now.
    className?: string;
}

interface ModEntry {
    id: string;
    name: string;
    version: string;
    loaders: string[];
    file: { path: string; name: string; size: number; mtimeMs: number };
    enabled?: boolean;
}

export function ModsTab({
    modpackId,
    instancePath,
    showAddButton = false,
    defaultMCVersion,
    defaultLoader,
    onUpdate,
    className,
}: ModsTabProps) {
    const { t } = useSettings();
    const [mods, setMods] = useState<ModEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModModal, setShowAddModModal] = useState(false);
    const confirm = useConfirm();
    const toast = useToast();

    const loadMods = useCallback(() => {
        setLoading(true);
        modpacksIPC
            .getMods(modpackId, instancePath)
            .then((list) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const withEnabled = (list ?? []).map((m: any) => ({
                    ...m,
                    enabled: !m.file.name.endsWith('.disabled'),
                }));
                setMods(withEnabled);
                onUpdate?.();
            })
            .catch((err) => {
                console.error('Failed to load mods:', err);
                setMods([]);
            })
            .finally(() => setLoading(false));
    }, [modpackId, instancePath, onUpdate]);

    useEffect(() => {
        let cancelled = false;

        modpacksIPC
            .getMods(modpackId, instancePath)
            .then((list) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const withEnabled = (list ?? []).map((m: any) => ({
                    ...m,
                    enabled: !m.file.name.endsWith('.disabled'),
                }));
                if (!cancelled) setMods(withEnabled);
            })
            .catch((err) => {
                console.error('Failed to load mods:', err);
                if (!cancelled) setMods([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [modpackId, instancePath]);

    const handleRemoveMod = useCallback(
        async (mod: ModEntry) => {
            const confirmed = await confirm.confirm({
                title: t('modpacks.remove_mod_title') || 'Remove mod',
                message: t('modpacks.remove_mod_confirm', { name: mod.name }) || `Remove mod "${mod.name}"?`,
                variant: 'danger',
                confirmText: t('modpacks.remove') || 'Remove',
                cancelText: t('general.cancel') || 'Cancel',
            });
            if (confirmed) {
                try {
                    await modpacksIPC.removeMod(modpackId, mod.file.name, instancePath);
                    loadMods();
                } catch (error) {
                    console.error('Error removing mod:', error);
                    toast.error(t('modpacks.remove_mod_error') || 'Failed to remove mod');
                }
            }
        },
        [modpackId, instancePath, confirm, loadMods, toast, t]
    );

    const handleModToggle = useCallback(
        async (mod: ModEntry) => {
            const enabled = !(mod.enabled ?? true);
            setMods((prev) =>
                prev.map((m) => (m.id === mod.id ? { ...m, enabled } : m))
            );
            try {
                await modpacksIPC.setModEnabled(modpackId, mod.file.name, enabled, instancePath);
            } catch (error) {
                setMods((prev) =>
                    prev.map((m) => (m.id === mod.id ? { ...m, enabled: !enabled } : m))
                );
                console.error('Error toggling mod:', error);
                toast.error(t('modpacks.mod_toggle_error') || 'Failed to toggle mod');
            }
        },
        [modpackId, instancePath, toast, t]
    );

    const handleOpenExternalLink = useCallback((url: string, context: string) => {
        void externalLinksIPC.open({ url, context }).catch((error) => {
            console.error('Failed to open external link:', error);
        });
    }, []);

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold dark:text-gray-200">
                    {t('modpacks.installed_mods') || 'Installed Mods'} {!loading && `(${mods.length})`}
                </h3>
                <div className="flex gap-2">
                    {showAddButton && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setShowAddModModal(true)}
                            disabled={loading}
                        >
                            {t('modpacks.add_mod_btn') || '+ Add Mod'}
                        </Button>
                    )}
                    <Button
                        onClick={loadMods}
                        variant="secondary"
                        size="sm"
                        disabled={loading}
                    >
                        {t('modpacks.update') || 'Refresh'}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    {t('modpacks.loading') || 'Loading...'}
                </div>
            ) : mods.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                    {t('modpacks.no_mods_installed') || 'No mods installed'}
                </div>
            ) : (
                <div className="grid gap-2">
                    {mods.map((mod) => (
                        <div
                            key={mod.id}
                            className={cn(
                                "flex items-center gap-4 p-3 rounded-lg border transition-all",
                                (mod.enabled ?? true)
                                    ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm"
                                    : "bg-gray-50 dark:bg-zinc-900/50 border-transparent opacity-70 hover:opacity-100"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium truncate text-gray-900 dark:text-gray-100">{mod.name}</h4>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                        {mod.version}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {mod.loaders.length > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-600">
                                            {mod.loaders.join(', ')}
                                        </span>
                                    )}
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{mod.file.name}</p>
                                </div>
                                <div className="flex gap-3 mt-1.5">
                                    <button
                                        type="button"
                                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleOpenExternalLink(
                                                `https://modrinth.com/mod/${modNameToSlug(mod.name)}`,
                                                `${mod.name} on Modrinth`,
                                            );
                                        }}
                                    >
                                        Modrinth
                                    </button>
                                    <button
                                        type="button"
                                        className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleOpenExternalLink(
                                                `https://www.curseforge.com/minecraft/mc-mods/${modNameToSlug(mod.name)}`,
                                                `${mod.name} on CurseForge`,
                                            );
                                        }}
                                    >
                                        CurseForge
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant={(mod.enabled ?? true) ? "primary" : "secondary"}
                                    size="sm"
                                    onClick={() => handleModToggle(mod)}
                                >
                                    {(mod.enabled ?? true) ? (t('modpacks.resourcepack_enable') || "Enabled") : (t('modpacks.resourcepack_disable') || "Disabled")}
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleRemoveMod(mod)}
                                >
                                    ✕
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {showAddButton && (
                <AddModModal
                    modpackId={modpackId}
                    isOpen={showAddModModal}
                    onClose={() => setShowAddModModal(false)}
                    onAdded={() => {
                        loadMods();
                        setShowAddModModal(false);
                    }}
                    defaultMCVersion={defaultMCVersion}
                    defaultLoader={defaultLoader}
                />
            )}
        </div>
    );
}
