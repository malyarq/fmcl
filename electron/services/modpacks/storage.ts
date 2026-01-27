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
export function loadModpacksMetadata(rootPath: string): ModpacksMetadataIndex {
  const metadataPath = getModpacksMetadataPath(rootPath);
  
  if (!fs.existsSync(metadataPath)) {
    // Создать пустой индекс, если файл не существует
    return {
      selectedModpack: 'default',
      modpacks: {},
    };
  }

  try {
    const raw = fs.readFileSync(metadataPath, 'utf-8');
    const parsed = JSON.parse(raw) as ModpacksMetadataIndex;
    
    // Нормализация
    if (!parsed.selectedModpack) parsed.selectedModpack = 'default';
    if (!parsed.modpacks) parsed.modpacks = {};
    
    return parsed;
  } catch (error) {
    console.error('Failed to load modpacks metadata:', error);
    return {
      selectedModpack: 'default',
      modpacks: {},
    };
  }
}

/**
 * Сохранить метаданные модпаков
 */
export function saveModpacksMetadata(rootPath: string, metadata: ModpacksMetadataIndex): void {
  const metadataPath = getModpacksMetadataPath(rootPath);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
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
