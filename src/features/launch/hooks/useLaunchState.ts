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
  const [useOptiFine, setUseOptiFine] = useState(false);

  const { isOffline } = useNetworkStatus();
  const { config: modpackConfig, setRuntimeMinecraft, setRuntimeLoader } = useModpack();

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
        useOptiFine,
        mcVersion: version,
        loaderType,
        optiFineVersions,
      })
    ) {
      setTimeout(() => setUseOptiFine(false), 0);
    }
  }, [version, forgeVersions, fabricVersions, optiFineVersions, neoForgeVersions, loaderType, setRuntimeLoader, useOptiFine]);

  // Auto-disable OptiFine when Forge is disabled (OptiFine only works with Forge)
  useEffect(() => {
    if (loaderType !== 'forge' && useOptiFine) {
      setTimeout(() => {
        setUseOptiFine(false);
      }, 0);
    }
  }, [loaderType, useOptiFine]);

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
    useOptiFine,
    setUseOptiFine,
    isOffline,
    launchVersion,
  };
}

