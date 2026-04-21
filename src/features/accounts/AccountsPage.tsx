import React, { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Account } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { AddAccountDialog } from './AddAccountDialog';
import { User, Check, Trash2, Plus, Server, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useConfirm } from '../../contexts/ConfirmContext';
import { accountIPC } from '../../services/ipc/accountIPC';
import { AccountSkinPanel } from './AccountSkinPanel';

interface AccountsPageProps {
    embedded?: boolean;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({ embedded = false }) => {
    const { t } = useSettings();
    const confirm = useConfirm();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getAccountDisabledMessage = useCallback((account: Account) => {
        if (account.disabledReason === 'insecureRemoteHttp') {
            return t('accounts.disabledInsecureAuthServer');
        }

        return t('accounts.disabledRecovery');
    }, [t]);

    const loadAccounts = useCallback(async () => {
        const [list, current] = await Promise.all([
            accountIPC.getAccounts(),
            accountIPC.getSelectedAccount(),
        ]);

        return {
            list,
            selectedId: current?.id ?? null,
        };
    }, []);

    const refreshAccounts = useCallback(async () => {
        try {
            const { list, selectedId: nextSelectedId } = await loadAccounts();
            setAccounts(list);
            setSelectedId(nextSelectedId);
            setError(null);
        } catch (nextError) {
            console.error('Failed to refresh accounts:', nextError);
            setError(nextError instanceof Error ? nextError.message : (t('accounts.loadError') || 'Failed to load accounts'));
        }
    }, [loadAccounts, t]);

    useEffect(() => {
        let isActive = true;

        void loadAccounts()
            .then(({ list, selectedId: nextSelectedId }) => {
                if (!isActive) {
                    return;
                }

                setAccounts(list);
                setSelectedId(nextSelectedId);
                setError(null);
            })
            .catch((nextError) => {
                if (!isActive) {
                    return;
                }

                console.error('Failed to load accounts:', nextError);
                setError(nextError instanceof Error ? nextError.message : (t('accounts.loadError') || 'Failed to load accounts'));
            });

        return () => {
            isActive = false;
        };
    }, [loadAccounts, t]);

    const handleSelect = async (id: string) => {
        try {
            await accountIPC.selectAccount(id);
            setSelectedId(id);
            setError(null);
        } catch (nextError) {
            console.error('Failed to select account:', nextError);
            setError(nextError instanceof Error ? nextError.message : (t('accounts.selectError') || 'Failed to select account'));
        }
    };

    const handleRemove = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmed = await confirm.confirm({
            title: t('accounts.removeTitle') || t('accounts.title'),
            message: t('accounts.confirmRemove'),
            confirmText: t('accounts.removeConfirm') || t('common.remove') || 'Remove',
            cancelText: t('common.cancel') || 'Cancel',
            variant: 'danger',
        });

        if (!confirmed) {
            return;
        }

        try {
            await accountIPC.removeAccount(id);
            await refreshAccounts();
        } catch (nextError) {
            console.error('Failed to remove account:', nextError);
            setError(nextError instanceof Error ? nextError.message : (t('accounts.removeError') || 'Failed to remove account'));
        }
    };

    const selectedAccount = accounts.find((account) => account.id === selectedId) ?? null;

    return (
        <div className="space-y-6">
            {!embedded && (
                <div className="settings-section-shell flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                        <div className="kicker-label flex items-center gap-2">
                            <ShieldCheck size={14} />
                            {t('accounts.providerSupportHint') || 'Blessing Skin and LittleSkin are supported for provider-aware skin management.'}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">{t('accounts.title')}</h2>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-secondary">{t('accounts.description')}</p>
                        </div>
                    </div>
                    <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 self-start">
                        <Plus size={18} />
                        {t('accounts.addAccount')}
                    </Button>
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200"
                >
                    {error}
                </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                    <div className="settings-section-shell flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            {embedded ? (
                                <>
                                    <p className="settings-embedded-title">{t('accounts.savedCountLabel')}</p>
                                    <p className="settings-embedded-copy">
                                        {t('accounts.providerSupportHint') || 'Blessing Skin and LittleSkin are supported for provider-aware skin management.'}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="settings-embedded-title">{t('accounts.title')}</p>
                                    <p className="settings-embedded-copy">{t('accounts.description')}</p>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <div className="text-xs text-secondary">{t('accounts.savedCountLabel')}</div>
                                <div className="text-lg font-semibold text-foreground">{accounts.length}</div>
                            </div>
                            {embedded && (
                                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2 self-start">
                                    <Plus size={18} />
                                    {t('accounts.addAccount')}
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4" role="list" aria-label={t('accounts.title')}>
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                role="listitem"
                                className={clsx(
                                    "surface-card group flex items-center justify-between gap-4 p-4 transition-all",
                                    account.isDisabled
                                        ? "bg-amber-500/10 border-amber-500/30"
                                        : selectedId === account.id
                                            ? "border-border-active bg-card/96"
                                            : "hover:border-border-active hover:bg-card"
                                )}
                                style={selectedId === account.id && !account.isDisabled ? {
                                    borderColor: 'rgb(var(--accent-main) / 0.35)',
                                    backgroundColor: 'rgb(var(--accent-main) / 0.1)',
                                } : undefined}
                            >
                                {account.isDisabled ? (
                                    <div className="flex min-w-0 flex-1 items-center gap-4">
                                        <div className="surface-muted flex h-12 w-12 items-center justify-center bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                            <User size={24} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                                                {account.name}
                                                {account.type === 'third-party' && (
                                                    <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                                                        <Server size={10} />
                                                        {t('accounts.typeThirdParty')}
                                                    </span>
                                                )}
                                                <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                                                    {t('accounts.disabledBadge')}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <div className="break-all text-secondary">{account.authServerUrl ?? account.id}</div>
                                                <div className="text-amber-700 dark:text-amber-200">{getAccountDisabledMessage(account)}</div>
                                                <div className="text-secondary">{t('accounts.disabledRecovery')}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => void handleSelect(account.id)}
                                        aria-pressed={selectedId === account.id}
                                        className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl text-left focus-visible:outline-none"
                                    >
                                        <div className={clsx(
                                            "surface-muted flex h-12 w-12 items-center justify-center",
                                            selectedId === account.id
                                                ? "text-foreground"
                                                : "text-secondary"
                                        )}>
                                            <User size={24} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                                                {account.name}
                                                {account.type === 'third-party' && (
                                                    <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                                                        <Server size={10} />
                                                        {t('accounts.typeThirdParty')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="truncate text-sm text-secondary">
                                                {account.type === 'offline' ? t('accounts.typeOffline') : account.user?.id ?? account.id}
                                            </div>
                                        </div>
                                    </button>
                                )}

                                <div className="flex items-center gap-2">
                                    {selectedId === account.id && !account.isDisabled && (
                                        <div className="mr-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                            <Check size={16} />
                                            <span className="text-sm font-medium">{t('accounts.active')}</span>
                                        </div>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => handleRemove(account.id, e)}
                                        aria-label={`${t('accounts.removeConfirm') || t('common.remove') || 'Remove'}: ${account.name}`}
                                        className={clsx(
                                            "transition-opacity text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10",
                                            account.isDisabled ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                                        )}
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        {accounts.length === 0 && (
                            <div className="surface-muted border-dashed py-12 text-center text-secondary">
                                <User size={48} className="mx-auto mb-4 opacity-50" />
                                <p>{t('accounts.noAccounts')}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="surface-card space-y-3 p-5">
                        <div className="kicker-label">{t('accounts.activeAccount')}</div>
                        {selectedAccount ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="surface-muted flex h-12 w-12 items-center justify-center">
                                        <User size={24} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-foreground">{selectedAccount.name}</p>
                                        <p className="truncate text-sm text-secondary">
                                            {selectedAccount.type === 'offline'
                                                ? t('accounts.typeOffline')
                                                : selectedAccount.authServerUrl ?? selectedAccount.user?.id ?? selectedAccount.id}
                                        </p>
                                    </div>
                                </div>
                                <p className="text-sm text-secondary">{t('accounts.skinManageHint')}</p>
                            </>
                        ) : (
                            <p className="text-sm text-secondary">{t('accounts.noAccounts')}</p>
                        )}
                    </div>

                    {selectedAccount && <AccountSkinPanel account={selectedAccount} />}
                </div>
            </div>

            <AddAccountDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onAdded={refreshAccounts}
            />
        </div>
    );
};
