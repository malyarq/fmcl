import type { ModpackConfig, ModLoaderType, NetworkMode } from '../types';
import { clamp, toMbFromGb } from './memory';

export function patchModpackConfig(prev: ModpackConfig, patch: Partial<ModpackConfig>): ModpackConfig {
  return { ...prev, ...patch } as ModpackConfig;
}

export function withModpackMemoryGb(prev: ModpackConfig, gb: number): ModpackConfig {
  const nextGb = clamp(gb, 1, 64);
  return {
    ...prev,
    memory: { maxMb: toMbFromGb(nextGb) },
  };
}

export function withModpackJavaPath(prev: ModpackConfig, javaPath: string): ModpackConfig {
  const nextPath = javaPath.trim();
  return {
    ...prev,
    java: nextPath ? { path: nextPath } : undefined,
  };
}

export function withRuntimeMinecraft(prev: ModpackConfig, mc: string): ModpackConfig {
  return {
    ...prev,
    runtime: {
      ...prev.runtime,
      minecraft: mc,
      modLoader: prev.runtime.modLoader ?? { type: 'vanilla' },
    },
  };
}

export function withRuntimeLoader(prev: ModpackConfig, loader: ModLoaderType): ModpackConfig {
  return {
    ...prev,
    runtime: {
      ...prev.runtime,
      modLoader: { ...(prev.runtime.modLoader ?? {}), type: loader },
    },
  };
}

export function withNetworkMode(prev: ModpackConfig, mode: NetworkMode): ModpackConfig {
  return { ...prev, networkMode: mode };
}

export function withVmOptions(prev: ModpackConfig, vmOptions: string[]): ModpackConfig {
  return { ...prev, vmOptions: Array.isArray(vmOptions) ? vmOptions : [] };
}

export function withGameExtraArgs(prev: ModpackConfig, args: string[]): ModpackConfig {
  return {
    ...prev,
    game: {
      ...(prev.game ?? {}),
      extraArgs: Array.isArray(args) ? args : [],
    },
  };
}

export function withGameResolution(
  prev: ModpackConfig,
  resolution?: { width?: number; height?: number; fullscreen?: boolean },
): ModpackConfig {
  return {
    ...prev,
    game: {
      ...(prev.game ?? {}),
      resolution,
    },
  };
}

export function withAutoConnectServer(prev: ModpackConfig, server?: { host: string; port: number }): ModpackConfig {
  return { ...prev, server };
}

