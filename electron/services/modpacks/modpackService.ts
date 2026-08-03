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
import { exportToCurseForge, exportToModrinth, exportToZip } from './exporters';
import { importModpack, getModpackInfoFromFile } from './importers';
import type { ModPlatformService } from '../mods/platform/modPlatformService';
import { scanModsFolder } from '../mods/scanner';
import type { ModEntry } from '../mods/types';
import { SafeZipWriter } from '../../security/zipWriter';
import type { ContentManager } from '../content/contentManager';
import { InstanceExporterService, type ExportOptions } from '../instances/exporter/InstanceExporterService';
import { app } from 'electron';
import { DownloadManager } from '../download/downloadManager';
import { downloadQueue } from '../download/downloadQueue';
import { assertAbsolutePath, assertChildName, assertPathWithinRoot, resolvePathWithinRoot } from '../../security/pathGuards';
import { resolveApprovedInstancePath, resolveLauncherRootPath } from '../instances/paths';

export type {
  ModpackConfig,
  ModpacksIndex,
  ModpackRuntime,
  ModLoaderType,
  NetworkMode,
};

type ManifestModLoader = { type: ModLoaderType; version?: string };

function formatManifestModLoaderId(modLoader?: ManifestModLoader): string | null {
  if (!modLoader) {
    return null;
  }

  if (modLoader.type === 'vanilla') {
    return 'vanilla';
  }

  return modLoader.version ? `${modLoader.type}-${modLoader.version}` : modLoader.type;
}

function buildManifestModLoaders(modLoader?: ManifestModLoader): Array<{ id: string; primary: boolean }> {
  const id = formatManifestModLoaderId(modLoader);
  return id ? [{ id, primary: true }] : [];
}

function parseManifestModLoaderId(loaderId: string): ManifestModLoader | undefined {
  const trimmedLoaderId = loaderId.trim();
  const normalizedLoaderId = trimmedLoaderId.toLowerCase();

  if (!trimmedLoaderId) {
    return undefined;
  }

  if (
    normalizedLoaderId === 'vanilla' ||
    normalizedLoaderId === 'forge' ||
    normalizedLoaderId === 'fabric' ||
    normalizedLoaderId === 'quilt' ||
    normalizedLoaderId === 'neoforge'
  ) {
    return { type: normalizedLoaderId as ModLoaderType };
  }

  const loaderPrefixes: Array<{ prefix: string; type: ModLoaderType }> = [
    { prefix: 'forge-', type: 'forge' },
    { prefix: 'fabric-', type: 'fabric' },
    { prefix: 'quilt-', type: 'quilt' },
    { prefix: 'neoforge-', type: 'neoforge' },
  ];

  for (const loaderPrefix of loaderPrefixes) {
    if (normalizedLoaderId.startsWith(loaderPrefix.prefix)) {
      const version = trimmedLoaderId.slice(loaderPrefix.prefix.length).trim();
      return {
        type: loaderPrefix.type,
        version: version || undefined,
      };
    }
  }

  return undefined;
}

/**
 * Расширенный сервис для работы с модпаками
 * Расширяет BaseModpackService методами для работы с метаданными модпаков
 */
export class ModpackService extends BaseModpackService {
  constructor(private readonly contentManager?: ContentManager) {
    super();
  }

  private resolveSafeRootPath(rootPath: string): string {
    return resolveLauncherRootPath(rootPath);
  }

  private resolveSafeModpackDir(rootPath: string, modpackId: string): string {
    return resolveApprovedInstancePath(this.getModpackDir(this.resolveSafeRootPath(rootPath), modpackId));
  }

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
   * Roll back a modpack created by an internal operation that did not publish.
   */
  public cleanupFailedCreation(rootPath: string, modpackId: string): void {
    super.cleanupFailedCreation(rootPath, modpackId);

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
        modLoaders: buildManifestModLoaders(modLoader),
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
    format: 'curseforge' | 'modrinth' | 'zip' | 'multimc',
    outputPath: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: any,
    platformService?: ModPlatformService,
  ): Promise<void> {
    const safeRootPath = this.resolveSafeRootPath(rootPath);
    const modpackDir = this.resolveSafeModpackDir(safeRootPath, modpackId);
    const safeOutputPath = assertAbsolutePath(outputPath, 'Modpack export output path');
    const metadata = this.getModpackMetadata(safeRootPath, modpackId);
    const config = this.loadModpackConfig(safeRootPath, modpackId);

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
        safeOutputPath,
        platformService,
      );
    } else if (format === 'modrinth') {
      await exportToModrinth(
        modpackDir,
        modpackName,
        modpackVersion,
        modpackId, // versionId для Modrinth
        safeOutputPath,
        platformService,
      );
    } else if (format === 'multimc') {
      const exporter = new InstanceExporterService(this);
      const exportOptions: ExportOptions = {
        includeSaves: options?.includeSaves,
        includeScreenshots: options?.includeScreenshots,
        includeResourcePacks: options?.includeResourcePacks,
        includeShaders: options?.includeShaders,
        includeMods: options?.includeMods,
      };
      await exporter.exportInstance(safeRootPath, modpackId, format, safeOutputPath, exportOptions);
    } else {
      await exportToZip(modpackDir, safeOutputPath);
    }
  }

  /**
   * Получить информацию о модпаке из файла (без импорта)
   */
  public async getModpackInfoFromFile(filePath: string): Promise<{
    format: 'curseforge' | 'modrinth' | 'zip' | 'multimc' | null;
    manifest: ModpackManifest | null;
    error?: string;
  }> {
    return await getModpackInfoFromFile(filePath);
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
    const safeRootPath = this.resolveSafeRootPath(rootPath);
    const safeFilePath = assertAbsolutePath(filePath, 'Modpack file path');

    if (!fs.existsSync(safeFilePath)) {
      throw new Error(`Modpack file not found: ${safeFilePath}`);
    }

    // Определить ID целевого модпака
    let modpackId = targetModpackId;
    let createdModpack = false;
    if (!modpackId) {
      // Создать новый модпак на основе имени файла
      const fileName = path.basename(safeFilePath, path.extname(safeFilePath));
      const { id } = super.createModpack(safeRootPath, fileName);
      modpackId = id;
      createdModpack = true;
    }

    try {
      const modpackDir = this.resolveSafeModpackDir(safeRootPath, modpackId);

      // Импортировать модпак (извлечь файлы)
      const { manifest, format } = await importModpack(safeFilePath, modpackDir);

      // Сохранить манифест
      const manifestPath = resolvePathWithinRoot(modpackDir, 'manifest.json', 'Manifest path');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      // Установить моды из манифеста
      if (platformService && (format === 'curseforge' || format === 'modrinth')) {
        await this.installModsFromManifest(safeRootPath, modpackId, manifest, platformService);
      }

      // Обновить конфигурацию на основе манифеста
      const config = this.loadModpackConfig(safeRootPath, modpackId);
      config.runtime = {
        minecraft: manifest.minecraft.version,
        modLoader: manifest.minecraft.modLoaders[0]
          ? parseManifestModLoaderId(manifest.minecraft.modLoaders[0].id)
          : undefined,
      };
      this.saveModpackConfig(safeRootPath, config);

      // Обновить метаданные
      const metadata = this.getModpackMetadata(safeRootPath, modpackId);
      metadata.name = manifest.name;
      metadata.version = manifest.version;
      metadata.author = manifest.author;
      metadata.minecraftVersion = manifest.minecraft.version;
      this.updateModpackMetadata(safeRootPath, modpackId, metadata);

      return { id: modpackId, config, metadata };
    } catch (error) {
      if (createdModpack && modpackId) {
        this.cleanupFailedCreation(safeRootPath, modpackId);
      }
      throw error;
    }
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
    const safeRootPath = this.resolveSafeRootPath(rootPath);
    const modpackDir = this.resolveSafeModpackDir(safeRootPath, modpackId);
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
          modLoaders: buildManifestModLoaders(config.runtime.modLoader),
        },
        name: config.name,
        version: '1.0.0',
        files: [],
      };
    }

    manifest.files = manifest.files.filter((entry) => {
      if (mod.platform === 'curseforge') {
        return !(entry.projectID === mod.projectId && entry.fileID === mod.versionId);
      }

      return !(entry.projectId === mod.projectId && entry.versionId === mod.versionId);
    });

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
    const safeRootPath = this.resolveSafeRootPath(rootPath);
    const modpackDir = this.resolveSafeModpackDir(safeRootPath, modpackId);
    const overridesDir = resolvePathWithinRoot(modpackDir, 'overrides', 'Overrides directory');

    // Создать папку overrides, если её нет
    if (!fs.existsSync(overridesDir)) {
      fs.mkdirSync(overridesDir, { recursive: true });
    }

    // Записать все файлы
    for (const [filePath, content] of Object.entries(overrides)) {
      const fullPath = resolvePathWithinRoot(overridesDir, filePath, `Override path "${filePath}"`);
      const dirPath = path.dirname(fullPath);

      // Создать директорию, если её нет
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Записать файл
      fs.writeFileSync(fullPath, content);
    }

    // Обновить манифест, чтобы указать наличие overrides
    const manifestPath = resolvePathWithinRoot(modpackDir, 'manifest.json', 'Manifest path');
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
    const modpackDir = this.resolveSafeModpackDir(rootPath, modpackId);
    const modsDir = resolvePathWithinRoot(modpackDir, 'mods', 'Mods directory');
    return scanModsFolder(modsDir);
  }

  /**
   * Создать резервную копию модпака
   */
  public async backupModpack(rootPath: string, modpackId: string): Promise<string> {
    const safeRootPath = this.resolveSafeRootPath(rootPath);
    const modpackDir = this.resolveSafeModpackDir(safeRootPath, modpackId);
    const backupsDir = resolvePathWithinRoot(safeRootPath, 'backups', 'Backups directory');

    // Создать папку backups, если её нет
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    // Создать имя файла бэкапа с timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFileName = `${modpackId}-${timestamp}.zip`;
    const backupPath = resolvePathWithinRoot(
      backupsDir,
      assertChildName(backupFileName, 'Backup file name'),
      'Backup path',
    );

    const zip = new SafeZipWriter();

    // Добавить все файлы из папки модпака в архив
    const addDirectoryToZip = (dir: string, zipPath: string = '') => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = assertPathWithinRoot(modpackDir, path.join(dir, file), 'Modpack backup source path');
        const stat = fs.lstatSync(filePath);
        const zipFilePath = zipPath ? path.join(zipPath, file) : file;

        if (stat.isDirectory()) {
          addDirectoryToZip(filePath, zipFilePath);
        } else {
          zip.addFile(zipFilePath.replace(/\\/g, '/'), filePath);
        }
      }
    };

    if (fs.existsSync(modpackDir)) {
      addDirectoryToZip(modpackDir);
    }

    // Сохранить архив
    await zip.writeTo(backupPath);

    return backupPath;
  }



  /**
   * Получить статистику хранилища контента
   */
  public async getContentStats() {
    if (!this.contentManager) {
      return { totalSize: 0, dedupedSize: 0, totalFiles: 0, storedFiles: 0 };
    }
    return this.contentManager.getStats();
  }

  /**
   * Очистить неиспользуемый контент
   */
  public async cleanupContent() {
    if (!this.contentManager) {
      return { freedSize: 0, deletedFiles: 0 };
    }
    return this.contentManager.cleanup();
  }

  /**
   * Создать модпак из манифеста (для импорта share code)
   */
  public async createFromManifest(
    rootPath: string,
    manifest: ModpackManifest,
    platformService: ModPlatformService
  ): Promise<{ id: string }> {
    const safeRootPath = this.resolveSafeRootPath(rootPath);
    // 1. Создать локальный модпак
    const modLoader = manifest.minecraft.modLoaders[0];
    const { id } = this.createLocalModpack(
      safeRootPath,
      manifest.name,
      manifest.version,
      manifest.minecraft.version,
      modLoader ? parseManifestModLoaderId(modLoader.id) : undefined
    );

    // 2. Установить моды
    await this.installModsFromManifest(safeRootPath, id, manifest, platformService);

    return { id };
  }

  /**
   * Установить моды из манифеста
   */
  public async installModsFromManifest(
    rootPath: string,
    modpackId: string,
    manifest: ModpackManifest,
    platformService: ModPlatformService,
  ): Promise<void> {
    const safeRootPath = this.resolveSafeRootPath(rootPath);
    const modpackDir = this.resolveSafeModpackDir(safeRootPath, modpackId);
    const modsDir = resolvePathWithinRoot(modpackDir, 'mods', 'Mods directory');

    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    for (const file of manifest.files) {
      try {
        if (file.projectID && file.fileID) {
          // CurseForge logic
          const curseforge = platformService.getCurseForgeClient();
          if (curseforge) {
            const modFile = await curseforge.getModFile(file.projectID, file.fileID);
            const modDownloadUrl = modFile.downloadUrl;
            if (modDownloadUrl) {
              const modDestination = resolvePathWithinRoot(
                modsDir,
                assertChildName(modFile.fileName, 'Mod file name'),
                'Mod file path',
              );
              const modSha1 = modFile.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value;

              if (this.contentManager && modSha1) {
                const storePath = this.contentManager.getStorePath(modSha1);
                if (fs.existsSync(storePath)) {
                  await this.contentManager.linkFile(modDestination, modSha1);
                } else {
                  const tempDir = path.join(app.getPath('temp'), 'fmcl-downloads');
                  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                  const tempFile = path.join(
                    tempDir,
                    assertChildName(`${modFile.fileName}-${Date.now()}`, 'Temporary mod file name'),
                  );

                  await downloadQueue.add(async () => {
                    await DownloadManager.downloadSingle(modDownloadUrl, tempFile, {
                      checksum: { algorithm: 'sha1', hash: modSha1 },
                    });
                  });

                  await this.contentManager.importFile(tempFile, modSha1, 'sha1');
                  await this.contentManager.linkFile(modDestination, modSha1);
                  fs.unlinkSync(tempFile);
                }
              } else {
                await downloadQueue.add(async () => {
                  await DownloadManager.downloadSingle(modDownloadUrl, modDestination, {
                    checksum: modSha1 ? { algorithm: 'sha1', hash: modSha1 } : undefined,
                  });
                });
              }
            }
          }
        } else if (file.projectId && file.versionId) {
          // Modrinth logic
          const modrinth = platformService.getModrinthClient();
          const version = await modrinth.getProjectVersion(file.versionId as string);
          const primaryFile = version.files.find((f) => f.primary) || version.files[0];

          if (primaryFile?.url) {
            const modDestination = resolvePathWithinRoot(
              modsDir,
              assertChildName(primaryFile.filename, 'Mod file name'),
              'Mod file path',
            );
            const modSha1 = primaryFile.hashes?.sha1;

            if (this.contentManager && modSha1) {
              const storePath = this.contentManager.getStorePath(modSha1);
              if (fs.existsSync(storePath)) {
                await this.contentManager.linkFile(modDestination, modSha1);
              } else {
                const tempDir = path.join(app.getPath('temp'), 'fmcl-downloads');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const tempFile = path.join(
                  tempDir,
                  assertChildName(`${primaryFile.filename}-${Date.now()}`, 'Temporary mod file name'),
                );

                await downloadQueue.add(async () => {
                  await DownloadManager.downloadSingle(primaryFile.url, tempFile, {
                    checksum: { algorithm: 'sha1', hash: modSha1 },
                  });
                });

                await this.contentManager.importFile(tempFile, modSha1, 'sha1');
                await this.contentManager.linkFile(modDestination, modSha1);
                fs.unlinkSync(tempFile);
              }
            } else {
              await downloadQueue.add(async () => {
                await DownloadManager.downloadSingle(primaryFile.url, modDestination, {
                  checksum: modSha1 ? { algorithm: 'sha1', hash: modSha1 } : undefined,
                });
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Failed to install mod from manifest:`, error);
      }
    }
  }
}
