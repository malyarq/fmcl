
import { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { Download, AlertCircle } from 'lucide-react';
import { ModpackManifest } from '@shared/types';
import { shareIPC } from '../../services/ipc/shareIPC';

interface ImportShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (manifest: ModpackManifest) => Promise<void>;
}

export function ImportShareModal({ isOpen, onClose, onImport }: ImportShareModalProps) {
    const { t } = useSettings();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        setCode('');
        setError(null);
        setLoading(false);
        onClose();
    };

    const handleImport = async () => {
        if (!code.trim()) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const manifest = await shareIPC.importCode(code.trim());
            await onImport(manifest);
            handleClose();
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : t('share.error_desc'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={
                <div className="flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    {t('share.import_title')}
                </div>
            }
        >

            <div className="space-y-4 py-4">
                <p className="text-sm text-secondary">
                    {t('share.import_desc')}
                </p>

                <Textarea
                    placeholder={t('share.code_placeholder')}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    aria-label={t('share.code_placeholder')}
                    className="min-h-[128px] resize-none font-mono text-xs"
                />

                {error && (
                    <div className="flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200" role="alert">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-4">
                <Button variant="ghost" onClick={handleClose} disabled={loading}>
                    {t('general.cancel')}
                </Button>
                <Button onClick={handleImport} disabled={loading || !code.trim()} isLoading={loading}>
                    {t('share.import_btn')}
                </Button>
            </div>
        </Modal>
    );
}
