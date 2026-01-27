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
  withNetworkMode,
  withRuntimeLoader,
  withRuntimeMinecraft,
  withVmOptions,
} from '../utils/configPatching';
import { saveModpackConfig as saveModpackConfigSvc } from '../services/instancesService';

export function useInstanceConfigPersistence(params: {
  rootPath?: string;
  setConfig: Dispatch<SetStateAction<ModpackConfig | null>>;
}) {
  const { rootPath, setConfig } = params;

  const saveTimer = useRef<number | null>(null);
  const pendingCfg = useRef<ModpackConfig | null>(null);

  const flushSave = useCallback(async () => {
    const cfg = pendingCfg.current;
    pendingCfg.current = null;
    if (!cfg) return;
    await saveModpackConfigSvc(cfg, rootPath);
  }, [rootPath]);

  const scheduleSave = useCallback(
    (cfg: ModpackConfig) => {
      pendingCfg.current = cfg;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        void flushSave();
      }, 250);
    },
    [flushSave]
  );

  // Best-effort cleanup to avoid leaving timers around on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      pendingCfg.current = null;
    };
  }, []);

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
    setJavaPath,
    setRuntimeMinecraft,
    setRuntimeLoader,
    setNetworkMode,
    setVmOptions,
    setGameExtraArgs,
    setGameResolution,
    setAutoConnectServer,
  };
}

