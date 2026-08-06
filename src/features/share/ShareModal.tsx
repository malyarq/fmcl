import { useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Share2, Copy, Check } from 'lucide-react';
import { cn } from '../../utils/cn';
import { shareIPC } from '../../services/ipc/shareIPC';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import { DegradedStateView } from '../../components/layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../utils/displayError';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    modpackId: string;
}

export function ShareModal({ isOpen, onClose, modpackId }: ShareModalProps) {
    const { t } = useSettings();
    const toast = useToast();
    const [code, setCode] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadedForId, setLoadedForId] = useState<string | null>(null);

    const loading = isOpen && Boolean(modpackId) && loadedForId !== modpackId && !error;

    useEffect(() => {
        if (!isOpen || !modpackId || loadedForId === modpackId) {
            return;
        }

        let isActive = true;

        void shareIPC.generateCode(modpackId)
                .then((nextCode) => {
                    if (!isActive) {
                        return;
                    }

                    setCode(nextCode);
                    setError(null);
                    setLoadedForId(modpackId);
                })
                .catch((err: unknown) => {
                    if (!isActive) {
                        return;
                    }

                    console.error(err);
                    setCode('');
                    setError(toDisplayErrorMessage(err, t('share.generateError')));
                    setLoadedForId(modpackId);
                })
        ;

        return () => {
            isActive = false;
        };
    }, [isOpen, loadedForId, modpackId, t]);

    const handleClose = () => {
        setCode('');
        setCopied(false);
        setError(null);
        setLoadedForId(null);
        onClose();
    };

    const handleCopy = async () => {
        if (!code) {
            return;
        }

        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error(err);
            toast.error(t('share.copyError'));
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            closeLabel={t('general.close_dialog')}
            title={
                <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    {t('share.title')}
                </div>
            }
        >

            <div className="space-y-5 py-2">
                <div className="space-y-2">
                    <p className="text-sm text-secondary">
                        {t('share.desc')}
                    </p>
                    <p className="text-xs text-muted">
                        {t('share.hint')}
                    </p>
                </div>

                <div className="surface-muted space-y-3 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                                {t('share.codeLabel')}
                            </p>
                            <p className="text-sm text-secondary">
                                {t('share.codeHelp')}
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-24 items-center justify-center rounded-2xl border border-border/60 bg-background/70">
                            <LoadingSpinner variant="accent" />
                        </div>
                    ) : error ? (
                        <DegradedStateView
                            variant="error"
                            layout="inline"
                            label={t('degraded.error_label')}
                            title={t('share.error_title')}
                            description={error}
                            footer={(
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setError(null);
                                        setLoadedForId(null);
                                    }}
                                >
                                    {t('operations.retry')}
                                </Button>
                            )}
                        />
                    ) : (
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Input
                                readOnly
                                value={code}
                                aria-label={t('share.codeLabel')}
                                className="font-mono text-xs"
                                onClick={(e) => e.currentTarget.select()}
                            />
                            <Button
                                onClick={() => {
                                    void handleCopy();
                                }}
                                variant={copied ? 'primary' : 'secondary'}
                                className={cn('min-w-[140px] sm:self-start', copied && 'shadow-[0_14px_34px_rgba(16,185,129,0.28)]')}
                            >
                                {copied ? (
                                    <>
                                        <Check className="h-4 w-4" />
                                        {t('error.copied')}
                                    </>
                                ) : (
                                    <>
                                        <Copy className="h-4 w-4" />
                                        {t('share.copy')}
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>

            </div>
        </Modal>
    );
}
