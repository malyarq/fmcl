import { useEffect, useMemo, useState } from 'react';
import { useModpack } from '../../../contexts/ModpackContext';
import type { ModLoaderType } from '../../../contexts/instances/types';
import { loadNickname, saveNickname } from '../services/launchPersistence';
import { computeLaunchVersion, isLoaderSupported, shouldDisableOptiFine } from '../services/launchValidation';
import { useNetworkStatus } from './useNetworkStatus';
import type { LoaderType } from '../types';

export type { LoaderType } from '../types';

export function useLaunchState(params: {
  forgeVersions: string[];
  fabricVersions: string[];
  optiFineVersions: string[];
  neoForgeVersions: string[];
}) {
  const { forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions } = params;

  const [nickname, setNickname] = useState(() => loadNickname());
  const [useOptiFineState, setUseOptiFineState] = useState(false);

  const { isOffline } = useNetworkStatus();
  const { config: modpackConfig, setRuntimeMinecraft, setRuntimeLoader, patchConfig } = useModpack();

  // Persist nickname across sessions.
  useEffect(() => {
    saveNickname(nickname);
  }, [nickname]);

  const version = modpackConfig?.runtime?.minecraft || '1.12.2';
  const loaderType = (modpackConfig?.runtime?.modLoader?.type || 'vanilla') as LoaderType;

  const useForge = loaderType === 'forge';
  const useFabric = loaderType === 'fabric';
  const useNeoForge = loaderType === 'neoforge';

  const setVersion = (v: string) => setRuntimeMinecraft(v);
  const setUseForge = (val: boolean) => setRuntimeLoader(val ? 'forge' : 'vanilla');
  const setUseFabric = (val: boolean) => setRuntimeLoader(val ? 'fabric' : 'vanilla');
  const setUseNeoForge = (val: boolean) => setRuntimeLoader(val ? 'neoforge' : 'vanilla');
  
  // Direct loader setter to avoid race conditions when switching between loaders
  // Only supports loaders that are available in the UI (vanilla, forge, fabric, neoforge)
  const setLoader = (loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge') => {
    setRuntimeLoader(loader as ModLoaderType);
  };

  // Sync OptiFine flag with modpack config (per-modpack setting).
  useEffect(() => {
    setUseOptiFineState(Boolean(modpackConfig?.game?.useOptiFine));
  }, [modpackConfig?.id, modpackConfig?.game?.useOptiFine]);

  const setUseOptiFine = (next: boolean) => {
    setUseOptiFineState(next);
    if (modpackConfig) {
      patchConfig({
        game: {
          ...(modpackConfig.game ?? {}),
          useOptiFine: next,
        },
      });
    }
  };

  // Auto-disable mods when version changes and mod is not supported
  useEffect(() => {
    if (
      !isLoaderSupported({
        loaderType,
        mcVersion: version,
        forgeVersions,
        fabricVersions,
        neoForgeVersions,
      })
    ) {
      setTimeout(() => setRuntimeLoader('vanilla'), 0);
    }

    if (
      shouldDisableOptiFine({
        useOptiFine: useOptiFineState,
        mcVersion: version,
        loaderType,
        optiFineVersions,
      })
    ) {
      setTimeout(() => setUseOptiFine(false), 0);
    }
  }, [version, forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions, loaderType, setRuntimeLoader, useOptiFineState, patchConfig, modpackConfig]);

  // Auto-disable OptiFine when Forge is disabled (OptiFine only works with Forge)
  useEffect(() => {
    if (loaderType !== 'forge' && useOptiFineState) {
      setTimeout(() => {
        setUseOptiFine(false);
      }, 0);
    }
  }, [loaderType, useOptiFineState, patchConfig, modpackConfig]);

  const launchVersion = useMemo(() => {
    return computeLaunchVersion({ loaderType, mcVersion: version });
  }, [loaderType, version]);

  return {
    modpackConfig: modpackConfig,
    nickname,
    setNickname,
    version,
    setVersion,
    loaderType,
    useForge,
    setUseForge,
    useFabric,
    setUseFabric,
    useNeoForge,
    setUseNeoForge,
    setLoader,
    useOptiFine: useOptiFineState,
    setUseOptiFine,
    isOffline,
    launchVersion,
  };
}

