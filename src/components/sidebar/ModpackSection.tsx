import { useState, useEffect } from 'react';
import { useModpack } from '../../contexts/ModpackContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/Button';
import { ModpackBrowser } from '../modpacks/ModpackBrowser';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackMetadata } from '@shared/types/modpack';
import { cn } from '../../utils/cn';

export function ModpackSection() {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const { selectedId, modpacks } = useModpack();
  const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  useEffect(() => {
    const loadMetadata = async () => {
      if (!selectedId) {
        setMetadata(null);
        return;
      }
      try {
        const meta = await modpacksIPC.getMetadata(selectedId, minecraftPath);
        setMetadata(meta);
      } catch (error) {
        console.error('Error loading modpack metadata:', error);
        setMetadata(null);
      }
    };
    loadMetadata();
  }, [selectedId, minecraftPath]);

  const selectedModpack = modpacks.find((m) => m.id === selectedId);

  if (!selectedModpack) {
    return (
      <>
        <div className="p-3 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
            {t('modpacks.no_modpack_selected')}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowBrowser(true)}
            className="w-full"
            style={getAccentStyles('bg').style}
          >
            {t('modpacks.select_modpack')}
          </Button>
        </div>
        {showBrowser && <ModpackBrowser isOpen={showBrowser} onClose={() => setShowBrowser(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="p-3 rounded-lg bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700" data-tour="modpacks">
        <div className="flex items-center gap-2 mb-2">
          {metadata?.iconUrl && (
            <img
              src={metadata.iconUrl}
              alt={selectedModpack.name}
              className="w-8 h-8 rounded object-cover"
              onError={(e) => {
                if (e.currentTarget.src !== '/icon.png') {
                  e.currentTarget.src = '/icon.png';
                }
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
              {t('modpacks.selected')}
            </p>
            <p
              className={cn('text-sm font-semibold truncate', getAccentStyles('text').className)}
              style={getAccentStyles('text').style}
            >
              {selectedModpack.name}
            </p>
            {metadata?.version && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('modpacks.version')}: {metadata.version}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowBrowser(true)}
          className="w-full mt-2"
        >
          {t('modpacks.change_modpack')}
        </Button>
      </div>
      {showBrowser && <ModpackBrowser isOpen={showBrowser} onClose={() => setShowBrowser(false)} />}
    </>
  );
}
