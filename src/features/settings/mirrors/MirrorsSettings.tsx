import React, { useCallback, useEffect, useState } from 'react';
import { Mirror } from '../../../../shared/types/mirrors';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { ArrowDown, ArrowUp, Globe, Plus, Trash, Wifi } from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '../../../contexts/SettingsContext';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { mirrorsIPC } from '../../../services/ipc/mirrorsIPC';

export const MirrorsSettings: React.FC = () => {
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
            title: t('common.remove') || 'Remove',
            message: t('mirrors.confirmRemove'),
            confirmText: t('common.remove') || 'Remove',
            cancelText: t('common.cancel') || 'Cancel',
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-foreground">{t('settings.downloads')}</h2>
                    <p className="text-sm text-secondary mt-1">
                        {t('mirrors.description')}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-secondary cursor-pointer select-none hover:text-foreground transition-colors">
                        <input
                            type="checkbox"
                            checked={autoSelect}
                            onChange={(e) => handleAutoSelectChange(e.target.checked)}
                            className="w-4 h-4 rounded border-border bg-card text-emerald-500 focus:ring-emerald-500 focus:ring-offset-background cursor-pointer"
                        />
                        {t('mirrors.autoSelect')}
                    </label>
                    <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
                        <Plus size={18} />
                        {t('mirrors.addCustom')}
                    </Button>
                </div>
            </div>

            <div className="grid gap-4" role="list" aria-label={t('mirrors.description')}>
                {mirrors.map((mirror) => (
                    <div
                        key={mirror.id}
                        role="listitem"
                        className={clsx(
                            "group relative p-4 rounded-xl border transition-all duration-200",
                            mirror.isDisabled
                                ? "bg-amber-500/10 border-amber-500/30"
                                : mirror.isActive
                                ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                : "bg-card/80 border-border hover:border-border-active hover:bg-card"
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                                <div className={clsx(
                                    "p-3 rounded-lg",
                                    mirror.isDisabled
                                        ? "bg-amber-500/20 text-amber-300"
                                        : mirror.isActive
                                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                                )}>
                                    <Globe size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-foreground">{mirror.name}</h3>
                                        <span className="px-2 py-0.5 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-full border border-zinc-200 dark:border-zinc-700">
                                            {mirror.isActive
                                                ? t('mirrors.priorityPrimary')
                                                : t('mirrors.priorityFallback', { priority: mirror.priority })}
                                        </span>
                                        {mirror.isActive && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/20">
                                                {t('mirrors.current')}
                                            </span>
                                        )}
                                        {mirror.type === 'official' && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/20">
                                                Official
                                            </span>
                                        )}
                                        {mirror.isDisabled && (
                                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/20">
                                                {t('mirrors.disabledBadge')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-1 text-sm text-secondary font-mono break-all">
                                        {mirror.rootUrl}
                                    </div>
                                    {mirror.isDisabled && (
                                        <div className="mt-2 space-y-1 text-sm">
                                            <div className="text-amber-700 dark:text-amber-200">{getMirrorDisabledMessage(mirror)}</div>
                                            <div className="text-secondary">{t('mirrors.disabledRecovery')}</div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-4 mt-3">
                                        {testResults[mirror.id] !== undefined && !mirror.isDisabled && (
                                            <div className={clsx(
                                                "text-xs font-medium flex items-center gap-1.5",
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
                                            disabled={isTesting[mirror.id] || mirror.isDisabled}
                                            aria-busy={isTesting[mirror.id] || undefined}
                                            aria-label={`${t('mirrors.testSpeed')}: ${mirror.name}`}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center gap-1 disabled:text-zinc-400 dark:disabled:text-zinc-500"
                                        >
                                            {mirror.isDisabled ? (
                                                t('mirrors.disabledBadge')
                                            ) : isTesting[mirror.id] ? (
                                                <span className="animate-pulse">{t('mirrors.testing')}</span>
                                            ) : (
                                                t('mirrors.testSpeed')
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleMoveMirror(mirror.id, 'up')}
                                    disabled={autoSelect || mirror.priority === 1}
                                    aria-label={`${t('mirrors.moveUp')}: ${mirror.name}`}
                                    className={clsx(
                                        "text-zinc-600 dark:text-zinc-300 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
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
                                        "text-zinc-600 dark:text-zinc-300 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800/50",
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
                                        aria-label={`${t('common.remove') || 'Remove'}: ${mirror.name}`}
                                        className={clsx(
                                            "text-red-400 hover:text-red-300 hover:bg-red-400/10",
                                            mirror.isDisabled && "opacity-100",
                                        )}
                                    >
                                        <Trash size={18} />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={t('mirrors.addCustomTitle')}
                className="max-w-md"
            >
                <div className="space-y-4">
                    <div>
                        <label htmlFor="custom-mirror-name" className="block text-sm font-medium text-secondary mb-1">
                            {t('mirrors.name')}
                        </label>
                        <input
                            id="custom-mirror-name"
                            type="text"
                            value={newMirrorName}
                            onChange={(e) => setNewMirrorName(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="My Custom Mirror"
                        />
                    </div>
                    <div>
                        <label htmlFor="custom-mirror-url" className="block text-sm font-medium text-secondary mb-1">
                            {t('mirrors.rootUrl')}
                        </label>
                        <input
                            id="custom-mirror-url"
                            type="text"
                            value={newMirrorUrl}
                            onChange={(e) => setNewMirrorUrl(e.target.value)}
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="https://bmclapi2.bangbang93.com"
                        />
                        <p className="text-xs text-secondary mt-1">
                            Must be a BMCLAPI-compatible mirror URL.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleAddMirror} disabled={!newMirrorName || !newMirrorUrl}>
                        {t('common.add')}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};
