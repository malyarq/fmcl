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
            <div className="flex gap-2 mb-6 bg-zinc-800 p-1 rounded-lg">
                <button
                    className={clsx(
                        "flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2",
                        authType === 'offline' ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
                    )}
                    onClick={() => setAuthType('offline')}
                >
                    <User size={16} />
                    {t('accounts.typeOffline')}
                </button>
                <button
                    className={clsx(
                        "flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2",
                        authType === 'third-party' ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"
                    )}
                    onClick={() => setAuthType('third-party')}
                >
                    <Server size={16} />
                    {t('accounts.typeThirdParty')}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {authType === 'offline' ? (
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">{t('accounts.nickname')}</label>
                        <Input
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="Steve"
                            autoFocus
                        />
                    </div>
                ) : (
                    <>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">{t('accounts.serverUrl')}</label>
                            <Input
                                value={serverUrl}
                                onChange={(e) => setServerUrl(e.target.value)}
                                placeholder="https://auth.example.com/api/yggdrasil"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">{t('accounts.username')}</label>
                            <Input
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Email or Username"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-300 mb-1">{t('accounts.password')}</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                            />
                        </div>
                    </>
                )}

                {error && (
                    <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
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
