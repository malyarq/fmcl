import { useCallback, useState } from 'react';
import { Download } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { useOperationSession } from '../operations/hooks/useOperationSession';
import { OperationStatusView } from '../operations/components/OperationStatusView';

interface ImportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommitted: () => Promise<void> | void;
}

export function ImportShareModal({ isOpen, onClose, onCommitted }: ImportShareModalProps) {
  const { t } = useSettings();
  const toast = useToast();
  const [code, setCode] = useState('');

  const closeSurface = useCallback(() => {
    setCode('');
    onClose();
  }, [onClose]);

  const operation = useOperationSession({
    enabled: isOpen,
    onCommitted,
    onTerminal: ({ classification }) => {
      if (!classification.isPresentationSuccess) return;
      toast.success(t('share.import_success'));
      closeSurface();
    },
  });

  const handleClose = () => {
    operation.reset();
    closeSurface();
  };

  const handleImport = async () => {
    const normalizedCode = code.trim();
    if (!normalizedCode) return;
    await operation.start({ kind: 'import-share', code: normalizedCode });
  };

  const loading = operation.isStarting || operation.isActive;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={(
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          {t('share.import_title')}
        </div>
      )}
    >
      <div className="space-y-4 py-4">
        <p className="text-sm text-secondary">{t('share.import_desc')}</p>

        <Textarea
          placeholder={t('share.code_placeholder')}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-label={t('share.code_placeholder')}
          className="min-h-[128px] resize-none font-mono text-xs"
          disabled={loading}
        />

        <OperationStatusView
          snapshot={operation.snapshot}
          classification={operation.classification}
          error={operation.error}
          errorFallback={t('share.error_desc')}
          onCancel={operation.cancel}
          onRetry={operation.retry}
          onReset={operation.reset}
          t={t}
          testId="share-import-operation-status"
        />
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2">
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          {t('general.cancel')}
        </Button>
        <Button
          onClick={() => { void handleImport(); }}
          disabled={loading || !code.trim()}
          isLoading={loading}
        >
          {t('share.import_btn')}
        </Button>
      </div>
    </Modal>
  );
}
