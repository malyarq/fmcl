import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ModpackConfig, ModLoaderType, NetworkMode } from '../types';
import {
  patchModpackConfig,
  withAutoConnectServer,
  withGameExtraArgs,
  withGameResolution,
  withModpackJavaPath,
  withModpackMemoryGb,
  withModpackMinMemoryGb,
  withNetworkMode,
  withRuntimeLoader,
  withRuntimeMinecraft,
  withVmOptions,
} from '../utils/configPatching';
import { saveModpackConfig as saveModpackConfigSvc } from '../services/instancesService';

export function useInstanceConfigPersistence(params: {
  setConfig: Dispatch<SetStateAction<ModpackConfig | null>>;
}) {
  const { setConfig } = params;

  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<ModpackConfig | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const flushSave = useCallback((): Promise<void> => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const pending = pendingSave.current;
    pendingSave.current = null;
    if (!pending) return saveQueue.current;

    const persist = () => saveModpackConfigSvc(pending);
    saveQueue.current = saveQueue.current.then(persist, persist);
    return saveQueue.current;
  }, []);

  const scheduleSave = useCallback(
    (cfg: ModpackConfig) => {
      pendingSave.current = cfg;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void flushSave();
      }, 250);
    },
    [flushSave]
  );

  // Flush the previous root before switching and flush pending work on unmount.
  useEffect(() => {
    return () => {
      void flushSave();
    };
  }, [flushSave]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushSave]);

  const saveConfig = useCallback(
    async (cfg: ModpackConfig) => {
      setConfig(cfg);
      scheduleSave(cfg);
    },
    [scheduleSave, setConfig]
  );

  const patchConfig = useCallback(
    (patch: Partial<ModpackConfig>) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = patchModpackConfig(prev, patch);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setMemoryGb = useCallback(
    (gb: number) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withModpackMemoryGb(prev, gb);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setMinMemoryGb = useCallback(
    (gb: number) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withModpackMinMemoryGb(prev, gb);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setJavaPath = useCallback(
    (javaPath: string) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withModpackJavaPath(prev, javaPath);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setRuntimeMinecraft = useCallback(
    (mc: string) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withRuntimeMinecraft(prev, mc);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setRuntimeLoader = useCallback(
    (loader: ModLoaderType) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withRuntimeLoader(prev, loader);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setNetworkMode = useCallback(
    (mode: NetworkMode) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withNetworkMode(prev, mode);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setVmOptions = useCallback(
    (vmOptions: string[]) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withVmOptions(prev, vmOptions);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setGameExtraArgs = useCallback(
    (args: string[]) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withGameExtraArgs(prev, args);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setGameResolution = useCallback(
    (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withGameResolution(prev, resolution);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  const setAutoConnectServer = useCallback(
    (server?: { host: string; port: number }) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next = withAutoConnectServer(prev, server);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave, setConfig]
  );

  return {
    saveConfig,
    patchConfig,
    setMemoryGb,
    setMinMemoryGb,
    setJavaPath,
    setRuntimeMinecraft,
    setRuntimeLoader,
    setNetworkMode,
    setVmOptions,
    setGameExtraArgs,
    setGameResolution,
    setAutoConnectServer,
    flushSave,
  };
}
