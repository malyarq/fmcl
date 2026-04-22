import { useState, useEffect } from 'react';
import { useModpack } from '../../contexts/ModpackContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Button } from '../ui/Button';
import { ModpackBrowser } from '../modpacks/ModpackBrowser';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModpackMetadata } from '@shared/types/modpack';
import { cn } from '../../utils/cn';
import { DEFAULT_MODPACK_BROWSER_STATE, type ModpackBrowserState } from '../../features/modpacks/hooks/useModpackNavigation';
import { LazyImage } from '../ui/LazyImage';

export function ModpackSection() {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const { selectedId, modpacks } = useModpack();
  const [metadata, setMetadata] = useState<ModpackMetadata | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserState, setBrowserState] = useState<ModpackBrowserState>(DEFAULT_MODPACK_BROWSER_STATE);

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
        <div className="surface-soft rounded-[20px] p-4">
          <p className="mb-3 text-sm text-secondary">
            {t('modpacks.no_modpack_selected')}
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowBrowser(true)}
            className="w-full min-h-[2.5rem]"
            style={getAccentStyles('bg').style}
          >
            {t('modpacks.select_modpack')}
          </Button>
        </div>
        {showBrowser && (
          <ModpackBrowser
            initialState={browserState}
            onBack={() => setShowBrowser(false)}
            onNavigate={() => setShowBrowser(false)}
            onStateChange={setBrowserState}
          />
        )}
      </>
    );
  }

  return (
      <>
      <div className="surface-soft rounded-[20px] p-4" data-tour="modpacks">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-border/70 bg-background/70">
            <LazyImage
              src={metadata?.iconUrl}
              alt={selectedModpack.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="mb-0.5 text-xs text-secondary">
              {t('modpacks.selected')}
            </p>
            <p
              className={cn('text-base font-semibold truncate', getAccentStyles('text').className)}
              style={getAccentStyles('text').style}
            >
              {selectedModpack.name}
            </p>
            {metadata?.version && (
              <p className="text-xs text-secondary">
                {t('modpacks.version')}: {metadata.version}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="secondary"
          size="md"
          onClick={() => setShowBrowser(true)}
          className="w-full mt-3 min-h-[2.5rem]"
        >
          {t('modpacks.change_modpack')}
        </Button>
      </div>
      {showBrowser && (
        <ModpackBrowser
          initialState={browserState}
          onBack={() => setShowBrowser(false)}
          onNavigate={() => setShowBrowser(false)}
          onStateChange={setBrowserState}
        />
      )}
    </>
  );
}
