import React, { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User, Server } from 'lucide-react';
import clsx from 'clsx';
import { accountIPC } from '../../services/ipc/accountIPC';

interface AddAccountDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAdded: () => void | Promise<void>;
}

type AuthType = 'offline' | 'third-party';

export const AddAccountDialog: React.FC<AddAccountDialogProps> = ({ isOpen, onClose, onAdded }) => {
    const { t } = useSettings();
    const [authType, setAuthType] = useState<AuthType>('offline');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Offline
    const [nickname, setNickname] = useState('');

    // Third Party
    const [serverUrl, setServerUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (authType === 'offline') {
                if (!nickname.trim()) throw new Error(t('accounts.nicknameRequired'));
                await accountIPC.addOfflineAccount(nickname);
            } else {
                if (!serverUrl.trim()) throw new Error(t('accounts.serverUrlRequired'));
                if (!username.trim()) throw new Error(t('accounts.usernameRequired'));
                // Password might be optional for some auth servers or specific flows, but usually required
                await accountIPC.addThirdPartyAccount(serverUrl, username, password || undefined);
            }
            await onAdded();
            onClose();
            // Reset form
            setNickname('');
            setServerUrl('');
            setUsername('');
            setPassword('');
            setAuthType('offline');
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : (t('accounts.addError') || 'Failed to add account'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('accounts.addAccount')}>
            <div className="surface-muted mb-4 space-y-2 p-4">
                <p className="kicker-label">{t('accounts.addAccount')}</p>
                <p className="text-sm leading-6 text-secondary">
                    {authType === 'offline'
                        ? (t('accounts.offlineHint') || 'Use an offline profile for quick local testing without provider authentication.')
                        : (t('accounts.thirdPartyHint') || 'Connect a Blessing Skin or LittleSkin compatible auth server over HTTPS or loopback.')}
                </p>
            </div>

            <div
                className="mb-6 flex gap-2 rounded-[20px] border border-border/60 bg-background/84 p-1 shadow-inner"
                role="group"
                aria-label={t('accounts.authMode') || 'Account type'}
            >
                <button
                    type="button"
                    className={clsx(
                        'flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors',
                        authType === 'offline' ? 'bg-card text-foreground shadow-sm' : 'text-secondary hover:text-foreground'
                    )}
                    aria-pressed={authType === 'offline'}
                    onClick={() => setAuthType('offline')}
                >
                    <User size={16} />
                    {t('accounts.typeOffline')}
                </button>
                <button
                    type="button"
                    className={clsx(
                        'flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-colors',
                        authType === 'third-party' ? 'bg-card text-foreground shadow-sm' : 'text-secondary hover:text-foreground'
                    )}
                    aria-pressed={authType === 'third-party'}
                    onClick={() => setAuthType('third-party')}
                >
                    <Server size={16} />
                    {t('accounts.typeThirdParty')}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {authType === 'offline' ? (
                    <div className="surface-card space-y-4 p-4">
                        <Input
                            label={t('accounts.nickname')}
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder={t('accounts.nicknamePlaceholder') || 'Steve'}
                            autoFocus
                            data-autofocus="true"
                        />
                    </div>
                ) : (
                    <div className="surface-card space-y-4 p-4">
                        <div>
                            <Input
                                label={t('accounts.serverUrl')}
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder={t('accounts.serverPlaceholder') || 'https://auth.example.com/api/yggdrasil'}
                                autoFocus
                                data-autofocus="true"
                            />
                        </div>
                        <div>
                            <Input
                                label={t('accounts.username')}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder={t('accounts.usernamePlaceholder') || 'Email or Username'}
                            />
                        </div>
                        <div>
                            <Input
                                label={t('accounts.password')}
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('accounts.passwordPlaceholder') || 'Password'}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="ghost" onClick={onClose} type="button">
                        {t('common.cancel')}
                    </Button>
                    <Button type="submit" isLoading={loading} disabled={loading}>
                        {t('common.add')}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
