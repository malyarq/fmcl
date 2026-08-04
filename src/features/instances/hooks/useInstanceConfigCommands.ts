import { useCallback, useMemo } from 'react';
import type { ModpackConfig, ModLoaderType, NetworkMode } from '../../../contexts/instances/types';
import {
  patchModpackConfig,
  withAutoConnectServer,
  withGameExtraArgs,
  withGameResolution,
  withModpackMemoryGb,
  withModpackMinMemoryGb,
  withNetworkMode,
  withRuntimeLoader,
  withRuntimeMinecraft,
  withVmOptions,
} from '../../../contexts/instances/utils/configPatching';
import { useInstanceQueryProvider } from '../InstanceQueryProvider';

export interface InstanceConfigCommands {
  saveConfig(config: ModpackConfig): Promise<void>;
  patchConfig(patch: Partial<ModpackConfig>): Promise<void>;
  setMemoryGb(gb: number): Promise<void>;
  setMinMemoryGb(gb: number): Promise<void>;
  setRuntimeMinecraft(minecraft: string): Promise<void>;
  setRuntimeLoader(loader: ModLoaderType): Promise<void>;
  setNetworkMode(mode: NetworkMode): Promise<void>;
  setVmOptions(options: string[]): Promise<void>;
  setGameExtraArgs(args: string[]): Promise<void>;
  setGameResolution(resolution?: { width?: number; height?: number; fullscreen?: boolean }): Promise<void>;
  setAutoConnectServer(server?: { host: string; port: number }): Promise<void>;
}

export function useInstanceConfigCommands(id: string | null | undefined): InstanceConfigCommands {
  const store = useInstanceQueryProvider();
  const mutate = useCallback(
    (update: (current: ModpackConfig) => ModpackConfig) => id
      ? store.mutateInstance(id, update)
      : Promise.resolve(),
    [id, store],
  );

  return useMemo(() => ({
    saveConfig: (config: ModpackConfig) => store.mutateInstance(config.id, () => config),
    patchConfig: (patch: Partial<ModpackConfig>) => mutate((current) => patchModpackConfig(current, patch)),
    setMemoryGb: (gb: number) => mutate((current) => withModpackMemoryGb(current, gb)),
    setMinMemoryGb: (gb: number) => mutate((current) => withModpackMinMemoryGb(current, gb)),
    setRuntimeMinecraft: (minecraft: string) => mutate((current) => withRuntimeMinecraft(current, minecraft)),
    setRuntimeLoader: (loader: ModLoaderType) => mutate((current) => withRuntimeLoader(current, loader)),
    setNetworkMode: (mode: NetworkMode) => mutate((current) => withNetworkMode(current, mode)),
    setVmOptions: (options: string[]) => mutate((current) => withVmOptions(current, options)),
    setGameExtraArgs: (args: string[]) => mutate((current) => withGameExtraArgs(current, args)),
    setGameResolution: (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => (
      mutate((current) => withGameResolution(current, resolution))
    ),
    setAutoConnectServer: (server?: { host: string; port: number }) => (
      mutate((current) => withAutoConnectServer(current, server))
    ),
  }), [mutate, store]);
}

export function dispatchInstanceConfigCommand(command: Promise<void>): void {
  void command.catch((error: unknown) => {
    console.error('Could not persist instance configuration:', error);
  });
}
