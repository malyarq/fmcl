
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
        if (!code.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // Resolve code to manifest using backend
            const manifest = await shareIPC.importCode(code.trim());
            await onImport(manifest);
            handleClose();
        } catch (err: unknown) {
            console.error(err);
            setError(err instanceof Error ? err.message : (t('share.error_desc') || 'Ошибка импорта'));
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
                <p className="text-sm text-zinc-400">
                    {t('share.import_desc')}
                </p>

                <Textarea
                    placeholder={t('share.code_placeholder')}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="font-mono text-xs bg-zinc-950 border-zinc-800 min-h-[100px] resize-none focus:ring-zinc-700"
                />

                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-900/20 text-red-400 rounded-md text-sm border border-red-900/50">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-4">
                <Button variant="ghost" onClick={handleClose} disabled={loading} className="text-zinc-400 hover:text-zinc-100">
                    {t('general.cancel')}
                </Button>
                <Button onClick={handleImport} disabled={loading || !code.trim()} className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200">
                    {loading ? (
                        <span className="loading loading-spinner loading-xs mr-2"></span>
                    ) : null}
                    {t('share.import_btn')}
                </Button>
            </div>
        </Modal>
    );
}
