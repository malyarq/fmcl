import fs from 'node:fs';
import path from 'node:path';
import type { ModpackConfig, ModpackRuntime, ModpacksIndex } from './types';
import { ensureXmclFolders, getModpackConfigPath, getModpackDir, getModpacksIndexPath } from './paths';

function loadExistingDefaultConfig(rootPath: string): ModpackConfig | null {
  const cfgPath = getModpackConfigPath(rootPath, 'default');
  if (!fs.existsSync(cfgPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as ModpackConfig;
  } catch {
    return null;
  }
}

/**
 * Ensure XMCL-like modpack layout exists.
 * If there is no modpacks.json, create a `default` modpack.
 */
export function ensureModpacksMigratedFile(rootPath: string, seedDefault?: Partial<ModpackConfig>) {
  ensureXmclFolders(rootPath);
  const indexPath = getModpacksIndexPath(rootPath);
  if (fs.existsSync(indexPath)) return;

  const now = new Date().toISOString();
  const existingDefaultConfig = loadExistingDefaultConfig(rootPath);
  const defaultName = existingDefaultConfig?.name ?? seedDefault?.name ?? 'Default';
  const index: ModpacksIndex = {
    selectedModpack: 'default',
    modpacks: {
      default: { name: defaultName },
    },
  };

  const modpackDir = getModpackDir(rootPath, 'default');
  fs.mkdirSync(modpackDir, { recursive: true });
  fs.mkdirSync(path.join(modpackDir, 'mods'), { recursive: true });

  const mergedRuntime: ModpackRuntime =
    existingDefaultConfig?.runtime ??
    seedDefault?.runtime ??
    ({
      minecraft: '1.12.2',
      modLoader: { type: 'vanilla' },
    } as ModpackRuntime);

  const cfg: ModpackConfig = {
    id: 'default',
    name: defaultName,
    runtime: mergedRuntime,
    java: existingDefaultConfig?.java ?? seedDefault?.java,
    memory: existingDefaultConfig?.memory ?? seedDefault?.memory ?? { maxMb: 4096 },
    vmOptions: existingDefaultConfig?.vmOptions ?? seedDefault?.vmOptions ?? [],
    server: existingDefaultConfig?.server ?? seedDefault?.server,
    networkMode: existingDefaultConfig?.networkMode ?? seedDefault?.networkMode,
    createdAt: existingDefaultConfig?.createdAt ?? now,
    updatedAt: now,
  };

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  if (!existingDefaultConfig) {
    // Keep exact path behavior (modpack.json inside modpacks/default)
    fs.writeFileSync(getModpackConfigPath(rootPath, 'default'), JSON.stringify(cfg, null, 2), 'utf-8');
  }
}

export function loadModpacksIndexFile(rootPath: string): ModpacksIndex {
  const indexPath = getModpacksIndexPath(rootPath);
  const raw = fs.readFileSync(indexPath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  // minimal normalization - migrate old format if needed
  const result: ModpacksIndex = {
    selectedModpack: 'default',
    modpacks: { default: { name: 'Default' } },
  };
  
  if ('selectedModpack' in parsed && typeof parsed.selectedModpack === 'string') {
    result.selectedModpack = parsed.selectedModpack;
  } else if ('selectedInstance' in parsed && typeof parsed.selectedInstance === 'string') {
    result.selectedModpack = parsed.selectedInstance;
  }
  
  if ('modpacks' in parsed && typeof parsed.modpacks === 'object' && parsed.modpacks !== null) {
    result.modpacks = parsed.modpacks as ModpacksIndex['modpacks'];
  } else if ('instances' in parsed && typeof parsed.instances === 'object' && parsed.instances !== null) {
    result.modpacks = parsed.instances as ModpacksIndex['modpacks'];
  }
  
  return result;
}

export function saveModpacksIndexFile(rootPath: string, index: ModpacksIndex) {
  fs.writeFileSync(getModpacksIndexPath(rootPath), JSON.stringify(index, null, 2), 'utf-8');
}

// Legacy aliases for backward compatibility
export const ensureInstancesMigratedFile = ensureModpacksMigratedFile;
export const loadInstancesIndexFile = loadModpacksIndexFile;
export const saveInstancesIndexFile = saveModpacksIndexFile;
