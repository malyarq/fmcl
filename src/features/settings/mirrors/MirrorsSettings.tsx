import React, { useCallback, useEffect, useState } from 'react';
import { Mirror } from '../../../../shared/types/mirrors';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { ArrowDown, ArrowUp, Globe, Plus, Trash, Wifi } from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '../../../contexts/SettingsContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { mirrorsIPC } from '../../../services/ipc/mirrorsIPC';
import { Input } from '../../../components/ui/Input';

interface MirrorsSettingsProps {
    embedded?: boolean;
}

export const MirrorsSettings: React.FC<MirrorsSettingsProps> = ({ embedded = false }) => {
    const { t } = useSettings();
    const confirm = useConfirm();
    const [mirrors, setMirrors] = useState<Mirror[]>([]);
    const [testResults, setTestResults] = useState<Record<string, number | null>>({});
    const [isTesting, setIsTesting] = useState<Record<string, boolean>>({});

    // Dialog state for adding custom mirror
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newMirrorName, setNewMirrorName] = useState('');
    const [newMirrorUrl, setNewMirrorUrl] = useState('');

    const [autoSelect, setAutoSelect] = useState(false);

    const getMirrorDisabledMessage = useCallback((mirror: Mirror) => {
        if (mirror.disabledReason === 'insecureRemoteHttp') {
            return t('mirrors.disabledInsecureUrl');
        }

        return t('mirrors.disabledRecovery');
    }, [t]);

    // ... existing state ...

    const loadMirrors = useCallback(async () => {
        try {
            const list = await mirrorsIPC.getMirrors();
            setMirrors(list);
            const isAuto = await mirrorsIPC.isAutoSelectEnabled();
            setAutoSelect(isAuto);
        } catch (error) {
            console.error('Failed to load mirrors:', error);
        }
    }, []);

    useEffect(() => {
        void loadMirrors();
    }, [loadMirrors]);

    const handleAutoSelectChange = async (enabled: boolean) => {
        try {
            setAutoSelect(enabled); // Optimistic update
            await mirrorsIPC.setAutoSelect(enabled);
            // Reload mirrors to reflect any changes in active status
            await loadMirrors();
        } catch (error) {
            console.error('Failed to set auto-select:', error);
            setAutoSelect(!enabled); // Revert on error
        }
    };

    const handleSelectMirror = async (id: string) => {
        try {
            await mirrorsIPC.selectMirror(id);
            await loadMirrors();
        } catch (error) {
            console.error('Failed to select mirror:', error);
        }
    };

    const handleMoveMirror = async (id: string, direction: 'up' | 'down') => {
        try {
            await mirrorsIPC.moveMirror(id, direction);
            await loadMirrors();
        } catch (error) {
            console.error('Failed to move mirror:', error);
        }
    };

    const handleRemoveMirror = async (id: string) => {
        const confirmed = await confirm.confirm({
            title: t('common.remove'),
            message: t('mirrors.confirmRemove'),
            confirmText: t('common.remove'),
            cancelText: t('general.cancel'),
            variant: 'danger',
        });

        if (!confirmed) return;

        try {
            await mirrorsIPC.removeMirror(id);
            await loadMirrors();
        } catch (error) {
            console.error('Failed to remove mirror:', error);
        }
    };

    const handleAddMirror = async () => {
        if (!newMirrorName || !newMirrorUrl) return;
        try {
            await mirrorsIPC.addCustomMirror(newMirrorName, newMirrorUrl);
            setNewMirrorName('');
            setNewMirrorUrl('');
            setIsDialogOpen(false);
            await loadMirrors();
        } catch (error) {
            console.error('Failed to add mirror:', error);
        }
    };

    const runSpeedTest = async (mirror: Mirror) => {
        setIsTesting(prev => ({ ...prev, [mirror.id]: true }));
        try {
            // Test root URL or a known file? 
            // For now passing rootUrl, the backend handles the logic
            const latency = await mirrorsIPC.testSpeed(mirror.rootUrl);
            setTestResults(prev => ({ ...prev, [mirror.id]: latency }));
        } catch (error) {
            console.error('Speed test failed:', error);
            setTestResults(prev => ({ ...prev, [mirror.id]: -1 }));
        } finally {
            setIsTesting(prev => ({ ...prev, [mirror.id]: false }));
        }
    };

    const activeMirror = mirrors.find((mirror) => mirror.isActive) ?? null;

    return (
        <div className={embedded ? 'space-y-4' : 'space-y-6'}>
            <div className="settings-section-shell space-y-4 p-5">
                {!embedded && (
                    <div className="settings-section-copy">
                        <div className="kicker-label">{t('mirrors.sectionTitle')}</div>
                        <h2 className="text-lg font-bold text-foreground">{t('mirrors.sectionTitle')}</h2>
                        <p className="settings-embedded-copy">
                            {t('mirrors.description')}
                        </p>
                    </div>
                )}

                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="settings-toggle-row">
                            <div className="settings-toggle-copy">
                                <p className="settings-toggle-title">{t('mirrors.autoSelect')}</p>
                                <p id="mirrors-auto-select-hint" className="settings-toggle-description">
                                    {t('mirrors.priorityHint')}
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={autoSelect}
                                aria-label={t('mirrors.autoSelect')}
                                aria-describedby="mirrors-auto-select-hint"
                                data-state={autoSelect ? 'checked' : 'unchecked'}
                                onClick={() => void handleAutoSelectChange(!autoSelect)}
                                className="settings-toggle-switch"
                            >
                                <span
                                    className="settings-toggle-thumb"
                                    data-state={autoSelect ? 'checked' : 'unchecked'}
                                />
                            </button>
                        </div>

                        <div className="settings-control-card">
                            <p className="settings-toggle-title">{t('mirrors.current')}</p>
                            {activeMirror ? (
                                <div className="mt-1 space-y-1">
                                    <p className="text-sm text-foreground">{activeMirror.name}</p>
                                    <p className="break-all text-xs text-secondary">{activeMirror.rootUrl}</p>
                                </div>
                            ) : (
                                <p className="mt-1 text-sm text-secondary">{t('mirrors.priorityHint')}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                        <Button onClick={() => setIsDialogOpen(true)} variant="secondary" className="gap-2">
                            <Plus size={18} />
                            {t('mirrors.addCustom')}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="surface-card overflow-hidden" role="list" aria-label={t('mirrors.description')}>
                <div className="border-b border-border/60 px-4 py-3 text-sm text-secondary">
                    {autoSelect ? t('mirrors.priorityHint') : t('mirrors.priorityPrimary')}
                </div>
                <div className="divide-y divide-border/60">
                    {mirrors.map((mirror) => (
                        <div
                            key={mirror.id}
                            role="listitem"
                            className={clsx(
                                "group px-4 py-4 transition-colors",
                                mirror.isDisabled
                                    ? "bg-amber-500/10"
                                    : mirror.isActive
                                        ? "bg-emerald-500/10"
                                        : "hover:bg-card/72"
                            )}
                        >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex min-w-0 gap-3">
                                    <div className={clsx(
                                        "mt-0.5 rounded-xl p-2",
                                        mirror.isDisabled
                                            ? "bg-amber-500/20 text-amber-300"
                                            : mirror.isActive
                                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                                : "bg-background/80 text-secondary"
                                    )}>
                                        <Globe size={18} />
                                    </div>

                                    <div className="min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold text-foreground">{mirror.name}</h3>
                                            <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-xs font-medium text-secondary">
                                                {mirror.isActive
                                                    ? t('mirrors.priorityPrimary')
                                                    : t('mirrors.priorityFallback', { priority: mirror.priority })}
                                            </span>
                                            {mirror.isActive && (
                                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                    {t('mirrors.current')}
                                                </span>
                                            )}
                                            {mirror.type === 'official' && (
                                                <span className="rounded-full border border-blue-500/20 bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                                                    {t('mirrors.official')}
                                                </span>
                                            )}
                                            {mirror.isDisabled && (
                                                <span className="rounded-full border border-amber-500/20 bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                    {t('mirrors.disabledBadge')}
                                                </span>
                                            )}
                                        </div>

                                        <p className="break-all font-mono text-sm text-secondary">
                                            {mirror.rootUrl}
                                        </p>

                                        {mirror.isDisabled ? (
                                            <div className="space-y-1 text-sm">
                                                <div className="text-amber-700 dark:text-amber-200">{getMirrorDisabledMessage(mirror)}</div>
                                                <div className="text-secondary">{t('mirrors.disabledRecovery')}</div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                {testResults[mirror.id] !== undefined && (
                                                    <div className={clsx(
                                                        "flex items-center gap-1.5 font-medium",
                                                        testResults[mirror.id] === -1 ? "text-red-400" :
                                                            (testResults[mirror.id]! < 100 ? "text-emerald-400" :
                                                                (testResults[mirror.id]! < 300 ? "text-yellow-400" : "text-red-400"))
                                                    )}>
                                                        <Wifi size={14} />
                                                        {testResults[mirror.id] === -1
                                                            ? t('mirrors.testFailed')
                                                            : `${testResults[mirror.id]}ms`}
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => runSpeedTest(mirror)}
                                                    disabled={isTesting[mirror.id]}
                                                    aria-busy={isTesting[mirror.id] || undefined}
                                                    aria-label={`${t('mirrors.testSpeed')}: ${mirror.name}`}
                                                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-blue-600 transition-colors hover:bg-blue-500/10 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:text-blue-400 dark:hover:text-blue-300"
                                                >
                                                    {isTesting[mirror.id] ? (
                                                        <span className="animate-pulse">{t('mirrors.testing')}</span>
                                                    ) : (
                                                        t('mirrors.testSpeed')
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleMoveMirror(mirror.id, 'up')}
                                        disabled={autoSelect || mirror.priority === 1}
                                        aria-label={`${t('mirrors.moveUp')}: ${mirror.name}`}
                                        className={clsx(
                                            "text-secondary hover:text-foreground hover:bg-background/80",
                                            (autoSelect || mirror.priority === 1) && "opacity-50 cursor-not-allowed",
                                        )}
                                    >
                                        <ArrowUp size={16} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleMoveMirror(mirror.id, 'down')}
                                        disabled={autoSelect || mirror.priority === mirrors.length}
                                        aria-label={`${t('mirrors.moveDown')}: ${mirror.name}`}
                                        className={clsx(
                                            "text-secondary hover:text-foreground hover:bg-background/80",
                                            (autoSelect || mirror.priority === mirrors.length) && "opacity-50 cursor-not-allowed",
                                        )}
                                    >
                                        <ArrowDown size={16} />
                                    </Button>
                                    {!mirror.isActive && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => handleSelectMirror(mirror.id)}
                                            aria-label={`${t('mirrors.use')}: ${mirror.name}`}
                                            disabled={autoSelect || mirror.isDisabled}
                                            className={clsx(autoSelect && "opacity-50 cursor-not-allowed")}
                                        >
                                            {t('mirrors.use')}
                                        </Button>
                                    )}
                                    {mirror.type === 'custom' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveMirror(mirror.id)}
                                            aria-label={`${t('common.remove')}: ${mirror.name}`}
                                            className="text-red-400 hover:bg-red-400/10 hover:text-red-300"
                                        >
                                            <Trash size={18} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Modal
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={t('mirrors.addCustomTitle')}
                className="max-w-md"
            >
                <div className="space-y-4">
                    <Input
                        label={t('mirrors.name')}
                        aria-label={t('mirrors.name')}
                        value={newMirrorName}
                        onChange={(e) => setNewMirrorName(e.target.value)}
                        placeholder={t('mirrors.namePlaceholder')}
                    />
                    <div className="space-y-2">
                        <Input
                            label={t('mirrors.rootUrl')}
                            aria-label={t('mirrors.rootUrl')}
                            value={newMirrorUrl}
                            onChange={(e) => setNewMirrorUrl(e.target.value)}
                            placeholder={t('mirrors.rootUrlPlaceholder')}
                        />
                        <p className="text-xs text-secondary">
                            {t('mirrors.customHint')}
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                        {t('general.cancel')}
                    </Button>
                    <Button onClick={handleAddMirror} disabled={!newMirrorName || !newMirrorUrl}>
                        {t('common.add')}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
