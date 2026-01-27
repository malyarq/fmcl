import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { download } from '@xmcl/file-transfer';
import AdmZip from 'adm-zip';
import { ModrinthV2Client } from '@xmcl/modrinth';
import { ModpackService } from '../modpackService';
import { parseModrinthManifest } from '../parsers/modrinthParser';
import { ensureDir } from '../../mods/platform/fsUtils';
import type { ModpackMetadata } from '@shared/types/modpack';
import { createModpackMetadataFromConfig } from '../storage';

export interface ModrinthModpackInstallOptions {
  projectId: string;
  versionId: string;
  targetModpackId?: string;
  rootPath?: string;
  onProgress?: (progress: { downloaded: number; total: number; stage: string }) => void;
}

export interface ModrinthModpackInstallResult {
  modpackId: string;
  config: unknown;
  metadata: ModpackMetadata;
}

/**
 * Установка модпака с Modrinth
 */
export async function downloadModrinthModpack(
  modrinth: ModrinthV2Client,
  modpackService: ModpackService,
  options: ModrinthModpackInstallOptions,
): Promise<ModrinthModpackInstallResult> {
  const { projectId, versionId, targetModpackId, rootPath, onProgress } = options;
  const root = rootPath ?? modpackService.getDefaultRootPath();
  modpackService.ensureModpacksMigrated(root);

  onProgress?.({ downloaded: 0, total: 100, stage: 'Получение информации о модпаке...' });

  // Получить информацию о версии модпака
  const version = await modrinth.getProjectVersion(versionId);
  if (!version.files || version.files.length === 0) {
    throw new Error('Modrinth modpack version has no files');
  }

  // Найти .mrpack файл
  const mrpackFile = version.files.find((f) => f.filename.endsWith('.mrpack')) || version.files[0];
  if (!mrpackFile.url) {
    throw new Error('Modrinth modpack file has no download URL');
  }

  // Получить информацию о проекте для метаданных
  const project = await modrinth.getProject(projectId);

  onProgress?.({ downloaded: 10, total: 100, stage: 'Скачивание модпака...' });

  // Скачать .mrpack файл во временную папку
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modpack-'));
  const tempZipPath = path.join(tempDir, 'modpack.mrpack');

  try {
    const sha1 = mrpackFile.hashes?.sha1;
    await download({
      url: mrpackFile.url,
      destination: tempZipPath,
      validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
    });

    onProgress?.({ downloaded: 30, total: 100, stage: 'Распаковка модпака...' });

    // Распаковать .mrpack (это ZIP архив)
    const zip = new AdmZip(tempZipPath);
    const extractDir = path.join(tempDir, 'extracted');
    zip.extractAllTo(extractDir, true);

    onProgress?.({ downloaded: 40, total: 100, stage: 'Парсинг манифеста...' });

    // Найти и распарсить modrinth.index.json
    const manifestPath = path.join(extractDir, 'modrinth.index.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Modrinth modpack does not contain modrinth.index.json');
    }

    const manifestJson = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = parseModrinthManifest(manifestJson);

    // Получить версию Minecraft и модлоадер из API версии
    const mcVersion = version.game_versions[0] || '';
    const loaders = version.loaders || [];
    const loaderType = loaders.includes('forge') ? 'forge' : loaders.includes('fabric') ? 'fabric' : loaders.includes('quilt') ? 'quilt' : loaders.includes('neoforge') ? 'neoforge' : 'vanilla';

    // Обновить манифест с информацией из API
    manifest.minecraft.version = mcVersion;
    manifest.minecraft.modLoaders = loaders.map((loader) => ({
      id: loader,
      primary: loader === loaderType,
    }));

    // Создать модпак
    const modpackName = targetModpackId || manifest.name || project.title;
    const { id: modpackId, config } = modpackService.createModpack(root, modpackName, {
      runtime: {
        minecraft: mcVersion,
        modLoader: loaderType !== 'vanilla' ? { type: loaderType } : undefined,
      },
    });

    const modpackDir = modpackService.getModpackDir(root, modpackId);

    onProgress?.({ downloaded: 50, total: 100, stage: 'Установка файлов...' });

    // Установить все файлы из манифеста
    const totalFiles = manifest.files.length;
    let installedFiles = 0;

    for (const file of manifest.files) {
      try {
        // Определить путь назначения относительно корня модпака
        const filePath = file.path || '';
        if (!filePath) {
          console.warn('Skipping file with no path');
          continue;
        }

        // Проверка безопасности пути
        if (filePath.includes('..') || filePath.startsWith('/') || filePath.startsWith('\\')) {
          console.warn(`Skipping unsafe file path: ${filePath}`);
          continue;
        }

        const destination = path.join(modpackDir, filePath);
        ensureDir(path.dirname(destination));

        // Скачать файл
        if (!file.downloads || file.downloads.length === 0) {
          console.warn(`Skipping file ${filePath}: no download URLs`);
          continue;
        }

        const sha1 = file.hashes?.sha1;
        await download({
          url: file.downloads,
          destination,
          validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
        });

        installedFiles++;
        onProgress?.({
          downloaded: 50 + Math.floor((installedFiles / totalFiles) * 40),
          total: 100,
          stage: `Установка файлов (${installedFiles}/${totalFiles})...`,
        });
      } catch (error) {
        console.error(`Failed to install file ${file.path}:`, error);
        // Продолжаем установку других файлов даже если один не удался
      }
    }

    onProgress?.({ downloaded: 90, total: 100, stage: 'Копирование конфигов...' });

    // Скопировать overrides (если есть)
    const overridesDir = path.join(extractDir, 'overrides');
    if (fs.existsSync(overridesDir)) {
      const copyRecursive = (src: string, dest: string) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            ensureDir(destPath);
            copyRecursive(srcPath, destPath);
          } else {
            ensureDir(path.dirname(destPath));
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      copyRecursive(overridesDir, modpackDir);
    }

    // Сохранить манифест в папке модпака
    const modpackManifestPath = path.join(modpackDir, 'modrinth.index.json');
    fs.copyFileSync(manifestPath, modpackManifestPath);

    onProgress?.({ downloaded: 95, total: 100, stage: 'Создание метаданных...' });

    // Создать метаданные
    const metadata = createModpackMetadataFromConfig(
      config,
      'modrinth',
      projectId,
      versionId,
    );

    // Обновить метаданные с информацией из API
    // Modrinth project doesn't have owner field directly
    // Author information is typically in project.team or project.members
    // For now, we'll leave author undefined as it's not directly available
    const updatedMetadata = {
      ...metadata,
      name: project.title,
      version: version.version_number || version.name,
      description: project.description,
      iconUrl: project.icon_url,
      // Author is not directly available in Modrinth Project type
      author: undefined,
    };

    modpackService.updateModpackMetadata(root, modpackId, updatedMetadata);

    onProgress?.({ downloaded: 100, total: 100, stage: 'Готово!' });

    return {
      modpackId,
      config,
      metadata: updatedMetadata,
    };
  } finally {
    // Удалить временные файлы
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  }
}
