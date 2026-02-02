import fs from 'node:fs';
import path from 'node:path';
import { ModpackService as BaseModpackService } from '../instances/instanceService';
import type {
  ModpackConfig,
  ModpacksIndex,
  ModpackRuntime,
  ModLoaderType,
  NetworkMode,
} from '../instances/types';
import type { ModpackMetadata, ModpackSource, ModpackManifest } from '../../../shared/types/modpack';
import {
  loadModpacksMetadata,
  saveModpacksMetadata,
  createModpackMetadataFromConfig,
  getOrCreateModpackMetadata,
  updateModpackMetadata as updateMetadata,
} from './storage';
import { generateManifestFromInstance } from './exporters/manifestGenerator';
import { exportToCurseForge, exportToModrinth, exportToZip } from './exporters';
import { importModpack, getModpackInfoFromFile } from './importers';
import type { ModPlatformService } from '../mods/platform/modPlatformService';
import { scanModsFolder } from '../mods/scanner';
import type { ModEntry } from '../mods/types';
import AdmZip from 'adm-zip';

export type {
  ModpackConfig,
  ModpacksIndex,
  ModpackRuntime,
  ModLoaderType,
  NetworkMode,
};

/**
 * Расширенный сервис для работы с модпаками
 * Расширяет BaseModpackService методами для работы с метаданными модпаков
 */
export class ModpackService extends BaseModpackService {
  /**
   * Сохранить конфиг и синхронизировать metadata.minecraftVersion для отображения в списке
   */
  public override saveModpackConfig(rootPath: string, cfg: ModpackConfig): void {
    super.saveModpackConfig(rootPath, cfg);
    const metadata = loadModpacksMetadata(rootPath);
    if (metadata.modpacks[cfg.id] && cfg.runtime?.minecraft) {
      metadata.modpacks[cfg.id] = updateMetadata(metadata.modpacks[cfg.id], {
        minecraftVersion: cfg.runtime.minecraft,
      });
      saveModpacksMetadata(rootPath, metadata);
    }
  }

  /**
   * Получить метаданные модпака
   */
  public getModpackMetadata(rootPath: string, modpackId: string): ModpackMetadata {
    const metadata = loadModpacksMetadata(rootPath);
    
    if (metadata.modpacks[modpackId]) {
      return metadata.modpacks[modpackId];
    }
    
    // Если метаданные не найдены, создать их на основе конфигурации
    const config = super.loadModpackConfig(rootPath, modpackId);
    return getOrCreateModpackMetadata(rootPath, modpackId, config);
  }

  /**
   * Обновить метаданные модпака
   */
  public updateModpackMetadata(
    rootPath: string,
    modpackId: string,
    updates: Partial<ModpackMetadata>,
  ): ModpackMetadata {
    const metadata = loadModpacksMetadata(rootPath);
    const existing = this.getModpackMetadata(rootPath, modpackId);
    
    const updated = updateMetadata(existing, updates);
    metadata.modpacks[modpackId] = updated;
    saveModpacksMetadata(rootPath, metadata);
    
    return updated;
  }

  /**
   * Создать модпак с метаданными
   */
  public createModpackWithMetadata(
    rootPath: string,
    name: string,
    source: ModpackSource = 'local',
    sourceId?: string,
    sourceVersionId?: string,
    seed?: Partial<ModpackConfig>,
  ): { id: string; config: ModpackConfig; metadata: ModpackMetadata } {
    const { id, config } = super.createModpack(rootPath, name, seed);
    
    // Создать метаданные
    const metadata = createModpackMetadataFromConfig(config, source, sourceId, sourceVersionId);
    const modpackMetadata = loadModpacksMetadata(rootPath);
    modpackMetadata.modpacks[id] = metadata;
    saveModpacksMetadata(rootPath, modpackMetadata);
    
    return { id, config, metadata };
  }

  /**
   * Получить список модпаков с метаданными
   */
  public listModpacksWithMetadata(rootPath: string): Array<{
    id: string;
    name: string;
    path: string;
    selected: boolean;
    metadata: ModpackMetadata;
  }> {
    const list = super.listModpacks(rootPath);
    const metadata = loadModpacksMetadata(rootPath);
    
    return list.map((item) => {
      let modpackMetadata = metadata.modpacks[item.id];
      
      // Если метаданные не найдены, создать их на основе конфигурации
      if (!modpackMetadata) {
        const config = super.loadModpackConfig(rootPath, item.id);
        modpackMetadata = getOrCreateModpackMetadata(rootPath, item.id, config);
      }
      
      return {
        ...item,
        metadata: modpackMetadata,
      };
    });
  }

  /**
   * Удалить модпак (включая метаданные)
   */
  public deleteModpack(rootPath: string, modpackId: string): void {
    // Удалить модпак через базовый метод
    super.deleteModpack(rootPath, modpackId);
    
    // Удалить метаданные
    const metadata = loadModpacksMetadata(rootPath);
    if (metadata.modpacks[modpackId]) {
      delete metadata.modpacks[modpackId];
      if (metadata.selectedModpack === modpackId) {
        metadata.selectedModpack = 'default';
      }
      saveModpacksMetadata(rootPath, metadata);
    }
  }

  /**
   * Экспорт модпака из текущего инстанса (генерация манифеста)
   */
  public async exportModpackFromInstance(
    rootPath: string,
    modpackId: string,
    name: string,
    version: string,
    author?: string,
    platformService?: ModPlatformService,
  ): Promise<ModpackManifest> {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    
    if (!fs.existsSync(modpackDir)) {
      throw new Error(`Modpack directory not found: ${modpackDir}`);
    }

    const manifest = await generateManifestFromInstance(
      modpackDir,
      name,
      version,
      author,
      platformService,
    );

    // Сохранить манифест в папку модпака
    const manifestPath = path.join(modpackDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Обновить метаданные модпака
    const metadata = this.getModpackMetadata(rootPath, modpackId);
    metadata.name = name;
    metadata.version = version;
    if (author) {
      metadata.author = author;
    }
    metadata.updatedAt = new Date().toISOString();
    this.updateModpackMetadata(rootPath, modpackId, metadata);

    return manifest;
  }

  /**
   * Создать локальный модпак с базовым манифестом
   */
  public createLocalModpack(
    rootPath: string,
    name: string,
    version: string,
    minecraftVersion: string,
    modLoader?: { type: ModLoaderType; version?: string },
  ): { id: string; config: ModpackConfig; metadata: ModpackMetadata } {
    const seed: Partial<ModpackConfig> = {
      runtime: {
        minecraft: minecraftVersion,
        modLoader: modLoader ? {
          type: modLoader.type,
          version: modLoader.version,
        } : undefined,
      },
    };

    const result = this.createModpackWithMetadata(rootPath, name, 'local', undefined, undefined, seed);
    
    // Создать базовый манифест
    const modpackDir = this.getModpackDir(rootPath, result.id);
    const manifestPath = path.join(modpackDir, 'manifest.json');
    
    const manifest: ModpackManifest = {
      formatVersion: 1,
      minecraft: {
        version: minecraftVersion,
        modLoaders: modLoader ? [{
          id: modLoader.type === 'forge' ? `forge-${modLoader.version || ''}` :
              modLoader.type === 'fabric' ? `fabric-${modLoader.version || ''}` :
              modLoader.type === 'quilt' ? `quilt-${modLoader.version || ''}` :
              modLoader.type === 'neoforge' ? `neoforge-${modLoader.version || ''}` :
              modLoader.type,
          primary: true,
        }] : [],
      },
      name,
      version,
      files: [],
    };

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    return result;
  }

  /**
   * Экспорт модпака в указанный формат
   */
  public async exportModpack(
    rootPath: string,
    modpackId: string,
    format: 'curseforge' | 'modrinth' | 'zip',
    outputPath: string,
    platformService?: ModPlatformService,
  ): Promise<void> {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    const metadata = this.getModpackMetadata(rootPath, modpackId);
    const config = this.loadModpackConfig(rootPath, modpackId);

    if (!fs.existsSync(modpackDir)) {
      throw new Error(`Modpack directory not found: ${modpackDir}`);
    }

    const modpackName = metadata.name || config.name;
    const modpackVersion = metadata.version || '1.0.0';
    const author = metadata.author;

    if (format === 'curseforge') {
      await exportToCurseForge(
        modpackDir,
        modpackName,
        modpackVersion,
        author,
        outputPath,
        platformService,
      );
    } else if (format === 'modrinth') {
      await exportToModrinth(
        modpackDir,
        modpackName,
        modpackVersion,
        modpackId, // versionId для Modrinth
        outputPath,
        platformService,
      );
    } else {
      await exportToZip(modpackDir, outputPath);
    }
  }

  /**
   * Получить информацию о модпаке из файла (без импорта)
   */
  public getModpackInfoFromFile(filePath: string): {
    format: 'curseforge' | 'modrinth' | 'zip' | null;
    manifest: ModpackManifest | null;
    error?: string;
  } {
    return getModpackInfoFromFile(filePath);
  }

  /**
   * Импорт модпака из файла
   */
  public async importModpack(
    rootPath: string,
    filePath: string,
    targetModpackId?: string,
    platformService?: ModPlatformService,
  ): Promise<{ id: string; config: ModpackConfig; metadata: ModpackMetadata }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Modpack file not found: ${filePath}`);
    }

    // Определить ID целевого модпака
    let modpackId = targetModpackId;
    if (!modpackId) {
      // Создать новый модпак на основе имени файла
      const fileName = path.basename(filePath, path.extname(filePath));
      const { id } = super.createModpack(rootPath, fileName);
      modpackId = id;
    }

    const modpackDir = this.getModpackDir(rootPath, modpackId);
    
    // Импортировать модпак (извлечь файлы)
    const { manifest, format } = await importModpack(filePath, modpackDir);

    // Сохранить манифест
    const manifestPath = path.join(modpackDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    // Установить моды из манифеста (если это CurseForge или Modrinth модпак и есть platformService)
    if (platformService && (format === 'curseforge' || format === 'modrinth')) {
      const modsDir = path.join(modpackDir, 'mods');
      if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
      }

      for (const file of manifest.files) {
        try {
          if (file.projectID && file.fileID && format === 'curseforge') {
            // CurseForge мод
            const curseforge = platformService.getCurseForgeClient();
            if (curseforge) {
              const modFile = await curseforge.getModFile(file.projectID, file.fileID);
              const modDownloadUrl = modFile.downloadUrl;
              if (modDownloadUrl) {
                const { download } = await import('@xmcl/file-transfer');
                const modDestination = path.join(modsDir, modFile.fileName);
                const modSha1 = modFile.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value;
                
                await download({
                  url: modDownloadUrl,
                  destination: modDestination,
                  validator: modSha1 ? { algorithm: 'sha1', hash: modSha1 } : undefined,
                });
              }
            }
          } else if (file.projectId && file.versionId && format === 'modrinth') {
            // Modrinth мод
            const modrinth = platformService.getModrinthClient();
            const version = await modrinth.getProjectVersion(file.versionId as string);
            const primaryFile = version.files.find((f) => f.primary) || version.files[0];
            
            if (primaryFile?.url) {
              const { download } = await import('@xmcl/file-transfer');
              const modDestination = path.join(modsDir, primaryFile.filename);
              const modSha1 = primaryFile.hashes?.sha1;
              
              await download({
                url: primaryFile.url,
                destination: modDestination,
                validator: modSha1 ? { algorithm: 'sha1', hash: modSha1 } : undefined,
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to install mod from manifest:`, error);
          // Продолжаем установку других модов
        }
      }
    }

    // Обновить конфигурацию на основе манифеста
    const config = this.loadModpackConfig(rootPath, modpackId);
    config.runtime = {
      minecraft: manifest.minecraft.version,
      modLoader: manifest.minecraft.modLoaders[0] ? (() => {
        const loaderId = manifest.minecraft.modLoaders[0].id;
        if (loaderId.startsWith('forge-')) {
          return { type: 'forge' as ModLoaderType, version: loaderId.substring(6) };
        } else if (loaderId.startsWith('fabric-')) {
          return { type: 'fabric' as ModLoaderType, version: loaderId.substring(7) };
        } else if (loaderId.startsWith('quilt-')) {
          return { type: 'quilt' as ModLoaderType, version: loaderId.substring(6) };
        } else if (loaderId.startsWith('neoforge-')) {
          return { type: 'neoforge' as ModLoaderType, version: loaderId.substring(9) };
        }
        return undefined;
      })() : undefined,
    };
    this.saveModpackConfig(rootPath, config);

    // Обновить метаданные
    const metadata = this.getModpackMetadata(rootPath, modpackId);
    metadata.name = manifest.name;
    metadata.version = manifest.version;
    metadata.author = manifest.author;
    metadata.minecraftVersion = manifest.minecraft.version;
    this.updateModpackMetadata(rootPath, modpackId, metadata);

    return { id: modpackId, config, metadata };
  }

  /**
   * Добавить мод в модпак (обновить манифест)
   */
  public addModToModpack(
    rootPath: string,
    modpackId: string,
    mod: {
      platform: 'curseforge' | 'modrinth';
      projectId: string | number;
      versionId: string | number;
    },
  ): void {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    const manifestPath = path.join(modpackDir, 'manifest.json');

    let manifest: ModpackManifest;
    if (fs.existsSync(manifestPath)) {
      const manifestJson = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(manifestJson);
    } else {
      const config = this.loadModpackConfig(rootPath, modpackId);
      manifest = {
        formatVersion: 1,
        minecraft: {
          version: config.runtime.minecraft,
          modLoaders: config.runtime.modLoader ? [{
            id: config.runtime.modLoader.type === 'forge' ? `forge-${config.runtime.modLoader.version || ''}` :
                config.runtime.modLoader.type === 'fabric' ? `fabric-${config.runtime.modLoader.version || ''}` :
                config.runtime.modLoader.type === 'quilt' ? `quilt-${config.runtime.modLoader.version || ''}` :
                config.runtime.modLoader.type === 'neoforge' ? `neoforge-${config.runtime.modLoader.version || ''}` :
                config.runtime.modLoader.type,
            primary: true,
          }] : [],
        },
        name: config.name,
        version: '1.0.0',
        files: [],
      };
    }

    // Добавить мод в манифест
    if (mod.platform === 'curseforge') {
      manifest.files.push({
        projectID: mod.projectId as number,
        fileID: mod.versionId as number,
        required: true,
      });
    } else {
      manifest.files.push({
        projectId: mod.projectId as string,
        versionId: mod.versionId as string,
        required: true,
      });
    }

    // Сохранить манифест
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Включить/выключить мод (переименование .jar <-> .jar.disabled)
   */
  public setModEnabled(rootPath: string, modpackId: string, modPath: string, enabled: boolean): void {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    const modsDir = path.join(modpackDir, 'mods');
    const modFilePath = path.join(modsDir, modPath);

    if (!fs.existsSync(modFilePath)) return;

    const dir = path.dirname(modPath);

    if (enabled && modPath.endsWith('.jar.disabled')) {
      const newName = modPath.slice(0, -8);
      const newPath = path.join(modsDir, dir ? path.join(dir, newName) : newName);
      fs.renameSync(modFilePath, newPath);
    } else if (!enabled && modPath.endsWith('.jar') && !modPath.endsWith('.jar.disabled')) {
      const newPath = path.join(modsDir, dir ? path.join(dir, `${modPath}.disabled`) : `${modPath}.disabled`);
      fs.renameSync(modFilePath, newPath);
    }
  }

  /**
   * Удалить мод из модпака (обновить манифест)
   */
  public removeModFromModpack(
    rootPath: string,
    modpackId: string,
    modPath: string,
  ): void {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    const modsDir = path.join(modpackDir, 'mods');
    const modFilePath = path.join(modsDir, modPath);

    // Удалить файл мода
    if (fs.existsSync(modFilePath)) {
      fs.unlinkSync(modFilePath);
    }

    // Обновить манифест, если он существует
    const manifestPath = path.join(modpackDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifestJson = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: ModpackManifest = JSON.parse(manifestJson);

      // Удалить мод из манифеста
      manifest.files = manifest.files.filter((f) => {
        if (f.path) {
          return f.path !== modPath && f.path !== `mods/${modPath}`;
        }
        return true;
      });

      // Сохранить манифест
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  }

  /**
   * Обновить файлы в папке overrides модпака
   */
  public updateModpackOverrides(
    rootPath: string,
    modpackId: string,
    overrides: Record<string, Buffer>,
  ): void {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    const overridesDir = path.join(modpackDir, 'overrides');
    
    // Создать папку overrides, если её нет
    if (!fs.existsSync(overridesDir)) {
      fs.mkdirSync(overridesDir, { recursive: true });
    }

    // Записать все файлы
    for (const [filePath, content] of Object.entries(overrides)) {
      // Безопасность: проверка на path traversal
      const normalizedPath = path.normalize(filePath);
      if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
        throw new Error(`Invalid override path: ${filePath}`);
      }

      const fullPath = path.join(overridesDir, normalizedPath);
      const dirPath = path.dirname(fullPath);

      // Создать директорию, если её нет
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Записать файл
      fs.writeFileSync(fullPath, content);
    }

    // Обновить манифест, чтобы указать наличие overrides
    const manifestPath = path.join(modpackDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifestJson = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: ModpackManifest = JSON.parse(manifestJson);
      
      if (!manifest.overrides && Object.keys(overrides).length > 0) {
        manifest.overrides = 'overrides';
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }
    }
  }

  /**
   * Получить список модов в модпаке
   */
  public async getModpackMods(rootPath: string, modpackId: string): Promise<ModEntry[]> {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    const modsDir = path.join(modpackDir, 'mods');
    return scanModsFolder(modsDir);
  }

  /**
   * Создать резервную копию модпака
   */
  public async backupModpack(rootPath: string, modpackId: string): Promise<string> {
    const modpackDir = this.getModpackDir(rootPath, modpackId);
    const backupsDir = path.join(rootPath, 'backups');
    
    // Создать папку backups, если её нет
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Создать имя файла бэкапа с timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `${modpackId}-${timestamp}.zip`;
    const backupPath = path.join(backupsDir, backupFileName);

    // Использовать adm-zip для создания архива
    const zip = new AdmZip();

    // Добавить все файлы из папки модпака в архив
    const addDirectoryToZip = (dir: string, zipPath: string = '') => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const zipFilePath = zipPath ? path.join(zipPath, file) : file;

        if (stat.isDirectory()) {
          addDirectoryToZip(filePath, zipFilePath);
        } else {
          zip.addFile(zipFilePath, fs.readFileSync(filePath));
        }
      }
    };

    if (fs.existsSync(modpackDir)) {
      addDirectoryToZip(modpackDir);
    }

    // Сохранить архив
    zip.writeZip(backupPath);

    return backupPath;
  }
}
