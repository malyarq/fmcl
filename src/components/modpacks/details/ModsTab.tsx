import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, PackagePlus, RefreshCw, Trash2 } from 'lucide-react';
import type { ModEntry as SharedModEntry } from '@shared/types/mods';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { externalLinksIPC } from '../../../services/ipc/externalLinksIPC';
import { instanceModsIPC } from '../../../services/ipc/instanceModsIPC';
import { cn } from '../../../utils/cn';
import { modNameToSlug } from '../../../utils/modSlug';
import { AddModModal } from '../AddModModal';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

export interface ModsTabProps {
    instanceId: string;
    showAddButton?: boolean;
    defaultMCVersion?: string;
    defaultLoader?: string;
    onUpdate?: () => void;
    className?: string;
}

type ModEntry = SharedModEntry & { enabled: boolean };

function normalizeMods(list: SharedModEntry[]): ModEntry[] {
    return list.map((entry) => ({
        ...entry,
        enabled: !entry.file.name.endsWith('.disabled'),
    }));
}

export function ModsTab({
    instanceId,
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

    const loadMods = useCallback(async () => {
        setLoading(true);
        try {
            const list = await instanceModsIPC.list(instanceId);
            setMods(normalizeMods(list ?? []));
            onUpdate?.();
        } catch (err) {
            console.error('Failed to load mods:', err);
            setMods([]);
        } finally {
            setLoading(false);
        }
    }, [instanceId, onUpdate]);

    useEffect(() => {
        void loadMods();
    }, [loadMods]);

    const handleRemoveMod = useCallback(
        async (mod: ModEntry) => {
            const confirmed = await confirm.confirm({
                title: t('modpacks.remove_mod_title'),
                message: t('modpacks.remove_mod_confirm', { name: mod.name }),
                variant: 'danger',
                confirmText: t('modpacks.remove'),
                cancelText: t('general.cancel'),
            });

            if (!confirmed) {
                return;
            }

            try {
                await instanceModsIPC.remove(instanceId, mod.file.name);
                await loadMods();
            } catch (error) {
                console.error('Error removing mod:', error);
                toast.error(t('modpacks.remove_mod_error'));
            }
        },
        [confirm, instanceId, loadMods, t, toast]
    );

    const handleModToggle = useCallback(
        async (mod: ModEntry) => {
            const enabled = !mod.enabled;

            setMods((prev) => prev.map((entry) => (entry.id === mod.id ? { ...entry, enabled } : entry)));

            try {
                await instanceModsIPC.setEnabled(instanceId, mod.file.name, enabled);
            } catch (error) {
                console.error('Error toggling mod:', error);
                setMods((prev) => prev.map((entry) => (entry.id === mod.id ? { ...entry, enabled: !enabled } : entry)));
                toast.error(t('modpacks.mod_toggle_error'));
            }
        },
        [instanceId, t, toast]
    );

    const handleOpenExternalLink = useCallback((url: string, context: string) => {
        void externalLinksIPC.open({ url, context }).catch((error) => {
            console.error('Failed to open external link:', error);
        });
    }, []);

    const enabledCount = useMemo(() => mods.filter((mod) => mod.enabled).length, [mods]);

    return (
        <div className={cn('space-y-4', className)}>
            <div className="surface-card space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="kicker-label">{t('modpacks.tab_mods')}</div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">
                                {t('modpacks.installed_mods')} {!loading && <span className="text-secondary">({mods.length})</span>}
                            </h3>
                            <p className="text-sm text-secondary">{t('modpacks.mods_description')}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {showAddButton && (
                            <Button variant="primary" size="sm" onClick={() => setShowAddModModal(true)} disabled={loading}>
                                <PackagePlus className="h-4 w-4" />
                                {t('modpacks.add_mod_btn')}
                            </Button>
                        )}
                        <Button onClick={() => void loadMods()} variant="secondary" size="sm" disabled={loading}>
                            <RefreshCw className="h-4 w-4" />
                            {t('modpacks.update')}
                        </Button>
                    </div>
                </div>

                {!loading && mods.length > 0 && (
                    <div className="surface-inline flex flex-wrap items-center gap-3 p-3 text-sm text-secondary">
                        <span>{t('modpacks.mods_manage_hint')}</span>
                        <span className="text-foreground">
                            {enabledCount} {t('modpacks.enabled').toLowerCase()} / {mods.length}
                        </span>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                    <LoadingSpinner size="sm" variant="accent" />
                    {t('modpacks.loading')}
                </div>
            ) : mods.length === 0 ? (
                <div className="surface-muted flex flex-col items-center gap-2 p-8 text-center">
                    <p className="text-base font-semibold text-foreground">{t('modpacks.no_mods_installed')}</p>
                    <p className="max-w-xl text-sm text-secondary">{t('modpacks.mods_empty_hint')}</p>
                </div>
            ) : (
                <div className="space-y-3" role="list" aria-label={t('modpacks.installed_mods')}>
                    {mods.map((mod) => (
                        <div
                            key={mod.id}
                            role="listitem"
                            className={cn(
                                'surface-card flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between',
                                !mod.enabled && 'opacity-75'
                            )}
                        >
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="truncate text-base font-semibold text-foreground">{mod.name}</h4>
                                    <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                                        {mod.version}
                                    </span>
                                    {mod.loaders.length > 0 && (
                                        <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                                            {mod.loaders.join(', ')}
                                        </span>
                                    )}
                                </div>

                                <p className="truncate text-sm text-secondary">{mod.file.name}</p>

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start"
                                        onClick={() =>
                                            handleOpenExternalLink(
                                                `https://modrinth.com/mod/${modNameToSlug(mod.name)}`,
                                                `${mod.name} on Modrinth`,
                                            )
                                        }
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        {t('modpacks.open_modrinth')}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="justify-start"
                                        onClick={() =>
                                            handleOpenExternalLink(
                                                `https://www.curseforge.com/minecraft/mc-mods/${modNameToSlug(mod.name)}`,
                                                `${mod.name} on CurseForge`,
                                            )
                                        }
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        {t('modpacks.open_curseforge')}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                <Button
                                    variant={mod.enabled ? 'primary' : 'secondary'}
                                    size="sm"
                                    onClick={() => void handleModToggle(mod)}
                                >
                                    {mod.enabled ? t('general.disable') : t('general.enable')}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => void handleRemoveMod(mod)}
                                    aria-label={t('modpacks.remove_mod_confirm', { name: mod.name })}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showAddButton && (
                <AddModModal
                    modpackId={instanceId}
                    isOpen={showAddModModal}
                    onClose={() => setShowAddModModal(false)}
                    onAdded={loadMods}
                    defaultMCVersion={defaultMCVersion}
                    defaultLoader={defaultLoader}
                />
            )}
        </div>
    );
}
