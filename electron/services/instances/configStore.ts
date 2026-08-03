import fs from 'node:fs';
import path from 'node:path';
import type { ModpackConfig, ModpackRuntime } from './types';
import { getModpackConfigPath, getModpackDir } from './paths';
import { loadModpacksMetadata } from '../modpacks/storage';
import { AtomicJsonStore } from '../storage/atomicJsonStore';

function isModpackConfig(value: unknown): value is ModpackConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ModpackConfig>;
  const runtime = candidate.runtime;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && Boolean(runtime)
    && typeof runtime === 'object'
    && !Array.isArray(runtime)
    && typeof runtime.minecraft === 'string'
    && (runtime.modLoader === undefined
      || (Boolean(runtime.modLoader)
        && typeof runtime.modLoader === 'object'
        && !Array.isArray(runtime.modLoader)
        && ['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].includes(runtime.modLoader.type)
        && (runtime.modLoader.version === undefined || typeof runtime.modLoader.version === 'string')));
}

function createConfigStore(rootPath: string, modpackId: string): AtomicJsonStore<ModpackConfig> {
  return new AtomicJsonStore(getModpackConfigPath(rootPath, modpackId), {
    version: 1,
    validate: isModpackConfig,
  });
}

function resolveRecoveredRuntime(rootPath: string, modpackId: string): ModpackRuntime {
  const metadata = loadModpacksMetadata(rootPath).modpacks[modpackId];
  if (metadata?.minecraftVersion) {
    return {
      minecraft: metadata.minecraftVersion,
      modLoader: metadata.modLoader ?? { type: 'vanilla' },
    };
  }

  return {
    minecraft: '1.12.2',
    modLoader: { type: 'vanilla' },
  };
}

export function loadModpackConfigFile(rootPath: string, modpackId: string): ModpackConfig {
  const store = createConfigStore(rootPath, modpackId);
  const loaded = store.read();
  if (!loaded) {
    // If index says modpack exists but file missing, reconstruct minimal config.
    const metadata = loadModpacksMetadata(rootPath).modpacks[modpackId];
    const now = new Date().toISOString();
    const cfg: ModpackConfig = {
      id: modpackId,
      name: metadata?.name ?? modpackId,
      runtime: resolveRecoveredRuntime(rootPath, modpackId),
      memory: { maxMb: 4096 },
      vmOptions: [],
      createdAt: metadata?.createdAt ?? now,
      updatedAt: now,
    };
    fs.mkdirSync(getModpackDir(rootPath, modpackId), { recursive: true });
    fs.mkdirSync(path.join(getModpackDir(rootPath, modpackId), 'mods'), { recursive: true });
    store.write(cfg);
    return cfg;
  }
  return loaded.value;
}

export function saveModpackConfigFile(rootPath: string, cfg: ModpackConfig) {
  const now = new Date().toISOString();
  const dir = getModpackDir(rootPath, cfg.id);
  fs.mkdirSync(dir, { recursive: true });
  cfg.updatedAt = now;
  if (!cfg.createdAt) cfg.createdAt = now;
  createConfigStore(rootPath, cfg.id).write(cfg);
}
