import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ModpackConfig } from '../types';
import { bootstrapModpacksIfSupported } from '../services/instancesService';

export function useInstanceBootstrap(params: {
  rootPath?: string;
  refresh: () => Promise<void>;
  loadSelected: () => Promise<void>;
  setIsReady: (v: boolean) => void;
  setSelectedId: (id: string) => void;
  setConfig: Dispatch<SetStateAction<ModpackConfig | null>>;
}) {
  const { rootPath, refresh, loadSelected, setIsReady, setSelectedId, setConfig } = params;

  // Bootstrap / migration: if there is no instances.json yet, create it using legacy localStorage settings.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const boot = await bootstrapModpacksIfSupported(rootPath);
      if (cancelled) return;

      if (boot) {
        setSelectedId(boot.selectedId);
        setConfig(boot.config);
        await refresh();
        setIsReady(true);
        return;
      }

      await refresh();
      await loadSelected();
      setIsReady(true);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadSelected, refresh, rootPath, setConfig, setIsReady, setSelectedId]);
}

