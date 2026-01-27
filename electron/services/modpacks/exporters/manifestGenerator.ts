import fs from 'node:fs';
import path from 'node:path';
import { scanModsFolder } from '../../mods/scanner';
import type { ModEntry } from '../../mods/types';
import type { ModpackManifest } from '../../../../shared/types/modpack';
import { ModPlatformService } from '../../mods/platform/modPlatformService';
import type { ModLoaderType } from '../../instances/types';

export interface ModSourceInfo {
  platform: 'curseforge' | 'modrinth' | 'local';
  projectId?: string | number;
  fileId?: string | number;
  versionId?: string;
}

/**
 * Попытка найти мод на платформах по хешу SHA1
 * 
 * Примечание: В текущей реализации возвращает null, так как прямого поиска по хешу нет.
 * В будущем можно реализовать поиск через API или кэширование метаданных модов.
 */
async function findModByHash(
  _sha1: string,
  _modName: string,
  _platformService: ModPlatformService,
): Promise<ModSourceInfo | null> {
  // Modrinth и CurseForge не имеют прямого поиска по хешу
  // Можно попробовать поиск по имени мода, но это ненадежно
  // Для упрощения, возвращаем null - мод будет помечен как локальный
  // В будущем можно реализовать кэширование метаданных модов при установке

  return null;
}

/**
 * Генерация манифеста из текущего инстанса
 */
export async function generateManifestFromInstance(
  modpackDir: string,
  modpackName: string,
  modpackVersion: string,
  author?: string,
  platformService?: ModPlatformService,
): Promise<ModpackManifest> {
  const modsDir = path.join(modpackDir, 'mods');
  const configPath = path.join(modpackDir, 'modpack.json');

  // Загрузить конфигурацию модпака
  let minecraftVersion = '1.20.1';
  let modLoaders: Array<{ id: string; primary: boolean }> = [];

  if (fs.existsSync(configPath)) {
    try {
      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      
      if (config.runtime?.minecraft) {
        minecraftVersion = config.runtime.minecraft;
      }
      
      if (config.runtime?.modLoader) {
        const loader = config.runtime.modLoader;
        const loaderType = loader.type as ModLoaderType;
        const loaderVersion = loader.version || '';
        
        let loaderId = '';
        if (loaderType === 'forge') {
          loaderId = `forge-${loaderVersion}`;
        } else if (loaderType === 'fabric') {
          loaderId = `fabric-${loaderVersion}`;
        } else if (loaderType === 'quilt') {
          loaderId = `quilt-${loaderVersion}`;
        } else if (loaderType === 'neoforge') {
          loaderId = `neoforge-${loaderVersion}`;
        } else {
          loaderId = loaderType;
        }
        
        modLoaders = [{ id: loaderId, primary: true }];
      }
    } catch {
      // Игнорируем ошибки парсинга конфига
    }
  }

  // Сканировать моды
  const modEntries = await scanModsFolder(modsDir);
  
  // Собрать список файлов для манифеста
  const files: ModpackManifest['files'] = [];
  const modsToResolve: Array<{ entry: ModEntry; index: number }> = [];

  for (let i = 0; i < modEntries.length; i++) {
    const entry = modEntries[i];
    const relativePath = path.relative(modpackDir, entry.file.path);
    
    // Попытка найти источник мода
    let sourceInfo: ModSourceInfo | null = null;
    
    if (platformService && entry.hash.sha1) {
      try {
        sourceInfo = await findModByHash(entry.hash.sha1, entry.name, platformService);
      } catch {
        // Игнорируем ошибки поиска
      }
    }

    if (sourceInfo && sourceInfo.platform === 'curseforge') {
      files.push({
        projectID: sourceInfo.projectId as number,
        fileID: sourceInfo.fileId as number,
        required: true,
      });
    } else if (sourceInfo && sourceInfo.platform === 'modrinth') {
      files.push({
        projectId: sourceInfo.projectId as string,
        versionId: sourceInfo.versionId as string,
        path: relativePath,
        required: true,
      });
    } else {
      // Локальный мод - сохраняем путь
      files.push({
        path: relativePath,
        required: true,
      });
      
      // Добавляем в список для разрешения позже (если нужно)
      modsToResolve.push({ entry, index: files.length - 1 });
    }
  }

  // Собрать overrides (config, resourcepacks, shaderpacks и т.д.)
  const overrideDirs = ['config', 'resourcepacks', 'shaderpacks', 'saves', 'scripts'];
  const hasOverrides = overrideDirs.some((dir) => {
    const dirPath = path.join(modpackDir, dir);
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  });

  const manifest: ModpackManifest = {
    formatVersion: 1,
    minecraft: {
      version: minecraftVersion,
      modLoaders,
    },
    name: modpackName,
    version: modpackVersion,
    author,
    files,
    overrides: hasOverrides ? 'overrides' : undefined,
  };

  return manifest;
}
