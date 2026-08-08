import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import type { ResourcePack } from '@shared/types/resourcePack';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { resourcePacksIPC } from '../../../services/ipc/resourcePacksIPC';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/Button';
import { LazyImage } from '../../ui/LazyImage';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { DegradedStateView } from '../../layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../../utils/displayError';

interface ResourcePacksTabProps {
    instanceId: string;
    onUpdate?: () => void;
    onAddResourcePack?: () => void;
}

export function ResourcePacksTab({ instanceId, onUpdate, onAddResourcePack }: ResourcePacksTabProps) {
    const { t } = useSettings();
    const confirm = useConfirm();
    const [packs, setPacks] = useState<ResourcePack[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<unknown | null>(null);
    const toast = useToast();

    const loadPacks = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const list = await resourcePacksIPC.list(instanceId);
            setPacks(list);
        } catch (err) {
            console.error(err);
            setLoadError(err);
            toast.error(t('modpacks.resourcepack_load_error'));
        } finally {
            setLoading(false);
        }
    }, [instanceId, t, toast]);

    useEffect(() => {
        void loadPacks();
    }, [loadPacks]);

    const handleToggle = useCallback(
        async (pack: ResourcePack) => {
            try {
                if (pack.isEnabled) {
                    await resourcePacksIPC.disable(instanceId, pack.fileName);
                } else {
                    await resourcePacksIPC.enable(instanceId, pack.fileName);
                }
                await loadPacks();
                onUpdate?.();
            } catch {
                toast.error(t('modpacks.resourcepack_toggle_error'));
            }
        },
        [instanceId, loadPacks, onUpdate, t, toast]
    );

    const handleDelete = useCallback(
        async (pack: ResourcePack) => {
            const confirmed = await confirm.confirm({
                title: t('modpacks.installed_resourcepacks'),
                message: t('modpacks.resourcepack_delete_confirm', { name: pack.name }),
                variant: 'danger',
                confirmText: t('modpacks.delete'),
                cancelText: t('general.cancel'),
            });

            if (!confirmed) {
                return;
            }

            try {
                await resourcePacksIPC.delete(instanceId, pack.fileName);
                await loadPacks();
                onUpdate?.();
            } catch {
                toast.error(t('modpacks.resourcepack_delete_error'));
            }
        },
        [confirm, instanceId, loadPacks, onUpdate, t, toast]
    );

    const enabledPacks = useMemo(() => packs.filter((pack) => pack.isEnabled), [packs]);
    const resourcePackLoadDescription = loadError
        ? toDisplayErrorMessage(loadError, t('error.inline_fallback'))
        : t('error.inline_fallback');

    const handleMove = useCallback(
        async (pack: ResourcePack, direction: 'up' | 'down') => {
            const currentIndex = enabledPacks.findIndex((entry) => entry.fileName === pack.fileName);
            if (currentIndex === -1) {
                return;
            }

            const reordered = [...enabledPacks];
            if (direction === 'up') {
                if (currentIndex === 0) {
                    return;
                }
                [reordered[currentIndex - 1], reordered[currentIndex]] = [reordered[currentIndex], reordered[currentIndex - 1]];
            } else {
                if (currentIndex === enabledPacks.length - 1) {
                    return;
                }
                [reordered[currentIndex], reordered[currentIndex + 1]] = [reordered[currentIndex + 1], reordered[currentIndex]];
            }

            try {
                await resourcePacksIPC.reorder(
                    instanceId,
                    reordered.map((entry) => entry.fileName),
                );
                await loadPacks();
            } catch {
                toast.error(t('modpacks.resourcepack_reorder_error'));
            }
        },
        [enabledPacks, instanceId, loadPacks, t, toast]
    );

    return (
        <div className="space-y-4">
            <div className="surface-card space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="kicker-label">{t('modpacks.tab_resourcepacks')}</div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">{t('modpacks.installed_resourcepacks')}</h3>
                            <p className="text-sm text-secondary">{t('modpacks.resourcepacks_description')}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {onAddResourcePack && (
                            <Button onClick={onAddResourcePack} variant="primary" size="sm">
                                <ImagePlus className="h-4 w-4" />
                                {t('modpacks.add_resourcepack_btn')}
                            </Button>
                        )}
                        <Button onClick={() => void loadPacks()} variant="secondary" size="sm">
                            <RefreshCw className="h-4 w-4" />
                            {t('modpacks.update')}
                        </Button>
                    </div>
                </div>

                <div
                    className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,9rem))]"
                    data-testid="resourcepacks-summary"
                >
                    <div className="surface-inline p-3 text-sm text-secondary">
                        {t('modpacks.resourcepacks_priority_hint')}
                    </div>
                    <div className="surface-inline rounded-2xl px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('modpacks.enabled')}</p>
                        <p className="mt-2 text-base font-semibold text-foreground">{loadError ? t('degraded.unavailable_label') : enabledPacks.length}</p>
                    </div>
                    <div className="surface-inline rounded-2xl px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('modpacks.installed')}</p>
                        <p className="mt-2 text-base font-semibold text-foreground">{loadError ? t('degraded.unavailable_label') : packs.length}</p>
                    </div>
                </div>

                <div
                    className="surface-inline rounded-2xl border border-border/70 bg-background/60 p-3"
                    data-testid="resourcepacks-scope-note"
                >
                    <p className="text-sm font-medium text-foreground">
                        {t('modpacks.resourcepack_scope_title') || 'Instance-scoped resource packs'}
                    </p>
                    <p className="mt-1 text-sm text-secondary">
                        {t('modpacks.resourcepack_scope_desc')
                            || 'Resource packs added here only affect this modpack. Burrow does not mark them compatible or incompatible for you.'}
                    </p>
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
                    title={t('modpacks.resourcepack_load_error')}
                    description={resourcePackLoadDescription}
                    footer={(
                        <div className="flex flex-wrap gap-2">
                            {onAddResourcePack && (
                                <Button variant="primary" size="sm" onClick={onAddResourcePack}>
                                    <ImagePlus className="h-4 w-4" />
                                    {t('modpacks.add_resourcepack_btn')}
                                </Button>
                            )}
                            <Button variant="secondary" size="sm" onClick={() => void loadPacks()}>
                                <RefreshCw className="h-4 w-4" />
                                {t('modpacks.update')}
                            </Button>
                        </div>
                    )}
                />
            ) : packs.length === 0 ? (
                <DegradedStateView
                    variant="empty"
                    label={t('degraded.empty_label')}
                    title={t('modpacks.no_resourcepacks_installed')}
                    description={t('modpacks.resourcepacks_empty_hint')}
                    footer={onAddResourcePack ? (
                        <Button variant="primary" size="sm" onClick={onAddResourcePack}>
                            <ImagePlus className="h-4 w-4" />
                            {t('modpacks.add_resourcepack_btn')}
                        </Button>
                    ) : undefined}
                />
            ) : (
                <div className="space-y-3" role="list" aria-label={t('modpacks.installed_resourcepacks')}>
                    {packs.map((pack) => {
                        const enabledIndex = enabledPacks.findIndex((entry) => entry.fileName === pack.fileName);
                        const canMoveUp = pack.isEnabled && enabledIndex > 0;
                        const canMoveDown = pack.isEnabled && enabledIndex !== -1 && enabledIndex < enabledPacks.length - 1;

                        return (
                            <div
                                key={pack.fileName}
                                role="listitem"
                                className={cn('surface-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between', !pack.isEnabled && 'opacity-75')}
                            >
                                <div className="flex min-w-0 flex-1 items-center gap-4">
                                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-background/70">
                                        <LazyImage
                                            src={pack.iconUrl}
                                            className={cn('h-full w-full object-cover', !pack.isEnabled && 'grayscale')}
                                        />
                                    </div>

                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="break-words text-base font-semibold leading-5 text-foreground">{pack.name}</h4>
                                            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                                                {pack.isEnabled ? t('modpacks.filter_enabled') : t('modpacks.filter_disabled')}
                                            </span>
                                        </div>
                                        <p className="line-clamp-2 break-words text-sm text-secondary">{pack.description || pack.fileName}</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                    {pack.isEnabled && (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void handleMove(pack, 'up')}
                                                disabled={!canMoveUp}
                                                aria-label={t('modpacks.reorder_up')}
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => void handleMove(pack, 'down')}
                                                disabled={!canMoveDown}
                                                aria-label={t('modpacks.reorder_down')}
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}

                                    <Button
                                        variant={pack.isEnabled ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => void handleToggle(pack)}
                                    >
                                        {pack.isEnabled ? t('general.disable') : t('general.enable')}
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={() => void handleDelete(pack)}
                                        aria-label={t('modpacks.resourcepack_delete_confirm', { name: pack.name })}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
