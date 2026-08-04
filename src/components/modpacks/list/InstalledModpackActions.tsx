import { Compass, Download, PackagePlus } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/Button';

export interface InstalledModpackActionsProps {
  onImportCode: () => void;
  onCreate: () => void;
  onBrowse: () => void;
}

export function InstalledModpackActions({ onImportCode, onCreate, onBrowse }: InstalledModpackActionsProps) {
  const { t, getAccentStyles } = useSettings();
  const accent = getAccentStyles('bg');

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="installed-modpack-primary-actions">
      <Button
        variant="secondary"
        size="sm"
        geometry="catalog-primary"
        onClick={onImportCode}
        className="min-h-10 flex-1 justify-center gap-2 px-4 sm:flex-none"
        title={t('share.import_title')}
      >
        <Download className="h-4 w-4 shrink-0" />
        {t('modpacks.import_code_btn')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        geometry="catalog-primary"
        onClick={onCreate}
        className="min-h-10 flex-1 justify-center gap-2 px-4 sm:flex-none"
      >
        <PackagePlus className="h-4 w-4 shrink-0" />
        {t('modpacks.create')}
      </Button>
      <Button
        variant="primary"
        size="sm"
        geometry="catalog-primary"
        onClick={onBrowse}
        className={cn('min-h-10 flex-1 justify-center gap-2 px-4 sm:flex-none', accent.className)}
        style={accent.style}
      >
        <Compass className="h-4 w-4 shrink-0" />
        {t('modpacks.browser')}
      </Button>
    </div>
  );
}
