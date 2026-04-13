import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { ShaderPack } from '@shared/contracts/shaders';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { shadersIPC } from '../../../services/ipc/shadersIPC';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';

interface ShadersTabProps {
    instancePath: string;
    onUpdate?: () => void;
    onAddShader?: () => void;
}

export function ShadersTab({ instancePath, onUpdate, onAddShader }: ShadersTabProps) {
    const { t } = useSettings();
    const confirm = useConfirm();
    const [packs, setPacks] = useState<ShaderPack[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    const loadPacks = useCallback(async () => {
        setLoading(true);
        try {
            const list = await shadersIPC.list(instancePath);
            setPacks(list);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.shader_load_error'));
        } finally {
            setLoading(false);
        }
    }, [instancePath, t, toast]);

    useEffect(() => {
        void loadPacks();
    }, [loadPacks]);

    const handleSetActive = useCallback(
        async (pack: ShaderPack) => {
            try {
                await shadersIPC.setActive(pack.fileName, instancePath);
                await loadPacks();
                onUpdate?.();
                toast.success(t('modpacks.shader_active_success', { name: pack.name }));
            } catch {
                toast.error(t('modpacks.shader_set_error'));
            }
        },
        [instancePath, loadPacks, onUpdate, t, toast]
    );

    const handleDisable = useCallback(async () => {
        try {
            await shadersIPC.disable(instancePath);
            await loadPacks();
            onUpdate?.();
            toast.success(t('modpacks.shader_disable_success'));
        } catch {
            toast.error(t('modpacks.shader_disable_error'));
        }
    }, [instancePath, loadPacks, onUpdate, t, toast]);

    const handleDelete = useCallback(
        async (pack: ShaderPack) => {
            const confirmed = await confirm.confirm({
                title: t('modpacks.installed_shaders'),
                message: t('modpacks.shader_delete_confirm', { name: pack.name }),
                variant: 'danger',
                confirmText: t('modpacks.delete'),
                cancelText: t('general.cancel'),
            });

            if (!confirmed) {
                return;
            }

            try {
                await shadersIPC.delete(pack.fileName, instancePath);
                await loadPacks();
                onUpdate?.();
            } catch {
                toast.error(t('modpacks.shader_delete_error'));
            }
        },
        [confirm, instancePath, loadPacks, onUpdate, t, toast]
    );

    const activeShader = useMemo(() => packs.find((pack) => pack.isActive), [packs]);

    return (
        <div className="space-y-4">
            <div className="surface-card space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <div className="kicker-label">{t('modpacks.tab_shaders')}</div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">{t('modpacks.installed_shaders')}</h3>
                            <p className="text-sm text-secondary">{t('modpacks.shaders_description')}</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {onAddShader && (
                            <Button onClick={onAddShader} variant="primary" size="sm">
                                <Sparkles className="h-4 w-4" />
                                {t('modpacks.add_shader_btn')}
                            </Button>
                        )}
                        <Button onClick={() => void loadPacks()} variant="secondary" size="sm">
                            <RefreshCw className="h-4 w-4" />
                            {t('modpacks.update')}
                        </Button>
                    </div>
                </div>

                <div className="surface-inline flex flex-wrap items-center gap-3 p-3 text-sm text-secondary">
                    <span>{t('modpacks.active_shader_summary')}</span>
                    <span className="text-foreground">{activeShader?.name ?? t('modpacks.shader_active_none')}</span>
                    {activeShader && (
                        <Button variant="ghost" size="sm" onClick={() => void handleDisable()}>
                            {t('modpacks.shader_disable')}
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                    <LoadingSpinner size="sm" variant="accent" />
                    {t('modpacks.loading')}
                </div>
            ) : packs.length === 0 ? (
                <div className="surface-muted flex flex-col items-center gap-2 p-8 text-center">
                    <p className="text-base font-semibold text-foreground">{t('modpacks.no_shaders_installed')}</p>
                    <p className="max-w-xl text-sm text-secondary">{t('modpacks.shaders_empty_hint')}</p>
                </div>
            ) : (
                <div className="space-y-3" role="list" aria-label={t('modpacks.installed_shaders')}>
                    {packs.map((pack) => (
                        <div
                            key={pack.fileName}
                            role="listitem"
                            className={cn(
                                'surface-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between',
                                pack.isActive && 'border-emerald-500/40 bg-emerald-500/8'
                            )}
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-[rgb(var(--accent-main))]">
                                    <Wand2 className="h-6 w-6" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="truncate text-base font-semibold text-foreground">{pack.name}</h4>
                                        {pack.isActive && (
                                            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-400">
                                                {t('modpacks.shader_active')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="truncate text-sm text-secondary">{pack.fileName}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                {pack.isActive ? (
                                    <Button variant="secondary" size="sm" onClick={() => void handleDisable()}>
                                        {t('modpacks.shader_disable')}
                                    </Button>
                                ) : (
                                    <Button variant="primary" size="sm" onClick={() => void handleSetActive(pack)}>
                                        {t('modpacks.shader_activate')}
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => void handleDelete(pack)}
                                    aria-label={t('modpacks.shader_delete_confirm', { name: pack.name })}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
