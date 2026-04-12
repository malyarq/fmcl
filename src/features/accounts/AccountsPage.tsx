import React, { useCallback, useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Account } from '@shared/types';
import { Button } from '../../components/ui/Button';
import { AddAccountDialog } from './AddAccountDialog';
import { User, Check, Trash2, Plus, Server } from 'lucide-react';
import clsx from 'clsx';
import { useConfirm } from '../../contexts/ConfirmContext';
import { accountIPC } from '../../services/ipc/accountIPC';
import { AccountSkinPanel } from './AccountSkinPanel';

export const AccountsPage: React.FC = () => {
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">{t('accounts.title')}</h2>
                    <p className="text-secondary">{t('accounts.description')}</p>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
                    <Plus size={18} />
                    {t('accounts.addAccount')}
                </Button>
            </div>

            <div className="grid gap-4" role="list" aria-label={t('accounts.title')}>
                {error && (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200"
                    >
                        {error}
                    </div>
                )}

                {accounts.map((account) => (
                    <div
                        key={account.id}
                        role="listitem"
                        className={clsx(
                            "p-4 rounded-xl border transition-all flex items-center justify-between gap-4 group",
                            account.isDisabled
                                ? "bg-amber-500/10 border-amber-500/30"
                                : selectedId === account.id
                                ? "bg-emerald-500/10 border-emerald-500/50"
                                : "bg-card/80 border-border hover:border-border-active hover:bg-card"
                        )}
                    >
                        {account.isDisabled ? (
                            <div className="flex flex-1 items-center gap-4 min-w-0">
                                <div className="p-3 rounded-lg bg-amber-500/20 text-amber-300">
                                    <User size={24} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium text-foreground flex flex-wrap items-center gap-2">
                                        {account.name}
                                        {account.type === 'third-party' && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                                <Server size={10} />
                                                Third Party
                                            </span>
                                        )}
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                            {t('accounts.disabledBadge')}
                                        </span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <div className="text-secondary break-all">{account.authServerUrl ?? account.id}</div>
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
                                className="flex flex-1 items-center gap-4 min-w-0 rounded-lg text-left focus-visible:outline-none"
                            >
                                <div className={clsx(
                                    "p-3 rounded-lg",
                                    selectedId === account.id
                                        ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                                )}>
                                    <User size={24} />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium text-foreground flex flex-wrap items-center gap-2">
                                        {account.name}
                                        {account.type === 'third-party' && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                                <Server size={10} />
                                                Third Party
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-secondary truncate">
                                        {account.type === 'offline' ? 'Offline' : account.user?.id ?? account.id}
                                    </div>
                                </div>
                            </button>
                        )}

                        <div className="flex items-center gap-2">
                            {selectedId === account.id && !account.isDisabled && (
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mr-2">
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
                    <div className="text-center py-12 text-secondary bg-card/40 rounded-xl border border-dashed border-border">
                        <User size={48} className="mx-auto mb-4 opacity-50" />
                        <p>{t('accounts.noAccounts')}</p>
                    </div>
                )}
            </div>

            {selectedAccount && <AccountSkinPanel account={selectedAccount} />}

            <AddAccountDialog
                isOpen={isAddDialogOpen}
                onClose={() => setIsAddDialogOpen(false)}
                onAdded={refreshAccounts}
            />
        </div>
    );
};
