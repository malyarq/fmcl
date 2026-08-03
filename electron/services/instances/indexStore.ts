import fs from 'node:fs';
import path from 'node:path';
import type { ModpackConfig, ModpackRuntime, ModpacksIndex } from './types';
import { ensureXmclFolders, getModpackConfigPath, getModpackDir, getModpacksIndexPath } from './paths';
import { loadModpackConfigFile, saveModpackConfigFile } from './configStore';
import { AtomicJsonStore, getAtomicJsonBackupPath } from '../storage/atomicJsonStore';

type IndexDocument = {
  selectedModpack?: unknown;
  selectedInstance?: unknown;
  modpacks?: unknown;
  instances?: unknown;
};

function isIndexDocument(value: unknown): value is IndexDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as IndexDocument;
  const hasValidEntries = (entries: unknown): boolean => {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return false;
    return Object.entries(entries).every(([id, metadata]) => (
      id.length > 0
      && Boolean(metadata)
      && typeof metadata === 'object'
      && !Array.isArray(metadata)
      && typeof (metadata as { name?: unknown }).name === 'string'
    ));
  };

  const canonical = typeof candidate.selectedModpack === 'string'
    && hasValidEntries(candidate.modpacks);
  const legacy = typeof candidate.selectedInstance === 'string'
    && hasValidEntries(candidate.instances);
  return canonical || legacy;
}

function createIndexStore(rootPath: string): AtomicJsonStore<IndexDocument> {
  return new AtomicJsonStore(getModpacksIndexPath(rootPath), {
    version: 1,
    validate: isIndexDocument,
  });
}

function loadExistingDefaultConfig(rootPath: string): ModpackConfig | null {
  const cfgPath = getModpackConfigPath(rootPath, 'default');
  if (!fs.existsSync(cfgPath) && !fs.existsSync(getAtomicJsonBackupPath(cfgPath))) {
    return null;
  }
  return loadModpackConfigFile(rootPath, 'default');
}

/**
 * Ensure XMCL-like modpack layout exists.
 * If there is no modpacks.json, create a `default` modpack.
 */
export function ensureModpacksMigratedFile(rootPath: string, seedDefault?: Partial<ModpackConfig>) {
  ensureXmclFolders(rootPath);
  const indexStore = createIndexStore(rootPath);
  if (indexStore.read()) return;

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

  indexStore.write(index);
  if (!existingDefaultConfig) {
    // Keep exact path behavior (modpack.json inside modpacks/default)
    saveModpackConfigFile(rootPath, cfg);
  }
}

export function loadModpacksIndexFile(rootPath: string): ModpacksIndex {
  const loaded = createIndexStore(rootPath).read();
  if (!loaded) throw new Error(`Modpacks index does not exist: ${getModpacksIndexPath(rootPath)}`);
  const parsed = loaded.value;
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
  createIndexStore(rootPath).write(index);
}
