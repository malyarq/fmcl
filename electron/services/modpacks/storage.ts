import fs from 'node:fs';
import path from 'node:path';
import type { ModpackMetadata, ModpackSource } from '../../../shared/types/modpack';
import type { ModpackConfig } from '../instances/types';
import type { ModpacksMetadataIndex } from './types';

/**
 * Путь к файлу с метаданными модпаков
 */
export function getModpacksMetadataPath(rootPath: string): string {
  return path.join(rootPath, 'modpacks-metadata.json');
}

/**
 * Загрузить метаданные модпаков
 */

let metadataCache: ModpacksMetadataIndex | null = null;
let lastRootPath: string | null = null;

export function loadModpacksMetadata(rootPath: string): ModpacksMetadataIndex {
  // Use cache if available and path matches
  if (metadataCache && lastRootPath === rootPath) {
    // Return deep copy to prevent external mutation affecting cache
    return JSON.parse(JSON.stringify(metadataCache));
  }

  const metadataPath = getModpacksMetadataPath(rootPath);

  if (!fs.existsSync(metadataPath)) {
    // Create empty index if file doesn't exist
    const empty: ModpacksMetadataIndex = {
      selectedModpack: 'default',
      modpacks: {},
    };
    metadataCache = empty;
    lastRootPath = rootPath;
    return JSON.parse(JSON.stringify(empty));
  }

  try {
    const raw = fs.readFileSync(metadataPath, 'utf-8');
    const parsed = JSON.parse(raw) as ModpacksMetadataIndex;

    // Normalize
    if (!parsed.selectedModpack) parsed.selectedModpack = 'default';
    if (!parsed.modpacks) parsed.modpacks = {};

    metadataCache = parsed;
    lastRootPath = rootPath;

    return JSON.parse(JSON.stringify(parsed));
  } catch (error) {
    console.error('Failed to load modpacks metadata:', error);
    const empty: ModpacksMetadataIndex = {
      selectedModpack: 'default',
      modpacks: {},
    };
    return empty;
  }
}

/**
 * Save modpacks metadata
 */
export function saveModpacksMetadata(rootPath: string, metadata: ModpacksMetadataIndex): void {
  const metadataPath = getModpacksMetadataPath(rootPath);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // Update cache
  metadataCache = JSON.parse(JSON.stringify(metadata));
  lastRootPath = rootPath;
}

/**
 * Создать метаданные модпака на основе конфигурации
 */
export function createModpackMetadataFromConfig(
  config: ModpackConfig,
  source: ModpackSource = 'local',
  sourceId?: string,
  sourceVersionId?: string,
): ModpackMetadata {
  const now = new Date().toISOString();

  return {
    id: config.id,
    name: config.name,
    version: undefined, // Версия модпака (не версия Minecraft)
    source,
    sourceId,
    sourceVersionId,
    minecraftVersion: config.runtime.minecraft,
    modLoader: config.runtime.modLoader,
    iconUrl: undefined,
    description: undefined,
    author: undefined,
    createdAt: config.createdAt || now,
    updatedAt: config.updatedAt || now,
  };
}

/**
 * Обновить метаданные модпака, сохранив существующие значения
 */
export function updateModpackMetadata(
  existing: ModpackMetadata,
  updates: Partial<ModpackMetadata>,
): ModpackMetadata {
  return {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Получить метаданные модпака или создать их на основе конфигурации
 */
export function getOrCreateModpackMetadata(
  rootPath: string,
  modpackId: string,
  config: ModpackConfig,
): ModpackMetadata {
  const metadata = loadModpacksMetadata(rootPath);

  if (metadata.modpacks[modpackId]) {
    return metadata.modpacks[modpackId];
  }

  // Создать метаданные на основе конфигурации
  const newMetadata = createModpackMetadataFromConfig(config);
  metadata.modpacks[modpackId] = newMetadata;
  saveModpacksMetadata(rootPath, metadata);

  return newMetadata;
}

/**
 * Синхронизировать имя модпака в хранилище метаданных
 */
export function syncRenamedModpackMetadata(
  rootPath: string,
  config: ModpackConfig,
): ModpackMetadata {
  const metadata = loadModpacksMetadata(rootPath);
  const existing = metadata.modpacks[config.id];

  const renamedMetadata = existing
    ? updateModpackMetadata(existing, { name: config.name })
    : createModpackMetadataFromConfig(config);

  metadata.modpacks[config.id] = renamedMetadata;
  saveModpacksMetadata(rootPath, metadata);

  return renamedMetadata;
}

/**
 * Скопировать метаданные исходного модпака в новый модпак
 */
export function duplicateModpackMetadata(
  rootPath: string,
  sourceId: string,
  duplicatedConfig: ModpackConfig,
): ModpackMetadata {
  const metadata = loadModpacksMetadata(rootPath);
  const sourceMetadata = metadata.modpacks[sourceId];
  const now = new Date().toISOString();
  const createdAt = duplicatedConfig.createdAt || now;
  const updatedAt = duplicatedConfig.updatedAt || now;
  const duplicatedMetadata = sourceMetadata
    ? {
      ...sourceMetadata,
      id: duplicatedConfig.id,
      name: duplicatedConfig.name,
      createdAt,
      updatedAt,
    }
    : createModpackMetadataFromConfig(duplicatedConfig);

  metadata.modpacks[duplicatedConfig.id] = duplicatedMetadata;
  metadata.selectedModpack = duplicatedConfig.id;
  saveModpacksMetadata(rootPath, metadata);

  return duplicatedMetadata;
}
