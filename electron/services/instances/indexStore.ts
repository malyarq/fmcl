import fs from 'node:fs';
import path from 'node:path';
import type { ModpackConfig, ModpackRuntime, ModpacksIndex } from './types';
import { ensureXmclFolders, getModpackConfigPath, getModpackDir, getModpacksIndexPath } from './paths';

/**
 * Ensure XMCL-like modpack layout exists.
 * If there is no modpacks.json, create a `default` modpack.
 */
export function ensureModpacksMigratedFile(rootPath: string, seedDefault?: Partial<ModpackConfig>) {
  ensureXmclFolders(rootPath);
  const indexPath = getModpacksIndexPath(rootPath);
  if (fs.existsSync(indexPath)) return;

  const now = new Date().toISOString();
  const index: ModpacksIndex = {
    selectedModpack: 'default',
    modpacks: {
      default: { name: 'Default' },
    },
  };

  const modpackDir = getModpackDir(rootPath, 'default');
  fs.mkdirSync(modpackDir, { recursive: true });
  fs.mkdirSync(path.join(modpackDir, 'mods'), { recursive: true });

  const mergedRuntime: ModpackRuntime =
    seedDefault?.runtime ??
    ({
      minecraft: '1.12.2',
      modLoader: { type: 'vanilla' },
    } as ModpackRuntime);

  const cfg: ModpackConfig = {
    id: 'default',
    name: seedDefault?.name ?? 'Default',
    runtime: mergedRuntime,
    java: seedDefault?.java,
    memory: seedDefault?.memory ?? { maxMb: 4096 },
    vmOptions: seedDefault?.vmOptions ?? [],
    server: seedDefault?.server,
    networkMode: seedDefault?.networkMode,
    createdAt: now,
    updatedAt: now,
  };

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  // Keep exact path behavior (modpack.json inside modpacks/default)
  fs.writeFileSync(getModpackConfigPath(rootPath, 'default'), JSON.stringify(cfg, null, 2), 'utf-8');
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

