import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { download } from '@xmcl/file-transfer';
import { ModrinthV2Client } from '@xmcl/modrinth';
import { ModpackService } from '../modpackService';
import { parseModrinthManifest } from '../parsers/modrinthParser';
import { ensureDir } from '../../mods/platform/fsUtils';
import type { ModpackMetadata } from '@shared/types/modpack';
import { createModpackMetadataFromConfig } from '../storage';
import { extractZipSafely, openValidatedZip } from '../../../security/archivePolicy';
import { assertChildName, resolvePathWithinRoot } from '../../../security/pathGuards';
import { assertPublicHttpsUrl } from '../../../security/remoteUrls';

export interface ModrinthModpackInstallOptions {
  projectId: string;
  versionId: string;
  targetModpackId?: string;
  rootPath?: string;
  onProgress?: (progress: { downloaded: number; total: number; stage: string }) => void;
  checkCancelled?: () => void;
}

export interface ModrinthModpackInstallResult {
  modpackId: string;
  config: unknown;
  metadata: ModpackMetadata;
  missing: Array<{ path: string; reason: string }>;
}

/**
 * Установка модпака с Modrinth
 */
export async function downloadModrinthModpack(
  modrinth: ModrinthV2Client,
  modpackService: ModpackService,
  options: ModrinthModpackInstallOptions,
): Promise<ModrinthModpackInstallResult> {
  const { projectId, versionId, targetModpackId, rootPath, onProgress, checkCancelled } = options;
  const throwIfCancelled = () => checkCancelled?.();
  const root = rootPath ?? modpackService.getDefaultRootPath();
  modpackService.ensureModpacksMigrated(root);

  onProgress?.({ downloaded: 0, total: 100, stage: 'Получение информации о модпаке...' });

  // Получить информацию о версии модпака
  throwIfCancelled();
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
      url: assertPublicHttpsUrl(mrpackFile.url, 'Modrinth modpack download URL'),
      destination: tempZipPath,
      validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
    });
    throwIfCancelled();

    onProgress?.({ downloaded: 30, total: 100, stage: 'Распаковка модпака...' });

    // Распаковать .mrpack (это ZIP архив)
    const zip = await openValidatedZip(tempZipPath, 'Modrinth modpack');
    const extractDir = path.join(tempDir, 'extracted');
    try {
      await extractZipSafely(zip, extractDir);
    } finally {
      zip.close();
    }

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
    const missing: Array<{ path: string; reason: string }> = [];

    for (const file of manifest.files) {
      try {
        throwIfCancelled();
        // Определить путь назначения относительно корня модпака
        const filePath = file.path || '';
        if (!filePath) {
          throw new Error('provider file path is missing');
        }

        const destination = resolvePathWithinRoot(modpackDir, filePath, 'Modrinth provider file destination');
        ensureDir(path.dirname(destination));

        // Скачать файл
        if (!file.downloads || file.downloads.length === 0) {
          throw new Error('provider did not return a download URL');
        }

        const sha1 = file.hashes?.sha1;
        await download({
          url: file.downloads.map((url) => assertPublicHttpsUrl(url, `Modrinth file ${filePath} download URL`)),
          destination,
          validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
        });

        throwIfCancelled();
        installedFiles++;
        onProgress?.({
          downloaded: 50 + Math.floor((installedFiles / totalFiles) * 40),
          total: 100,
          stage: `Установка файлов (${installedFiles}/${totalFiles})...`,
        });
      } catch (error) {
        if (file.required) throw error;
        missing.push({ path: file.path || 'missing-path', reason: error instanceof Error ? error.message : 'optional provider download failed' });
      }
    }

    onProgress?.({ downloaded: 90, total: 100, stage: 'Копирование конфигов...' });

    // Скопировать overrides (если есть)
    const overridesDir = path.join(extractDir, 'overrides');
    if (fs.existsSync(overridesDir)) {
      const copyRecursive = (src: string, dest: string) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          throwIfCancelled();
          const safeName = assertChildName(entry.name, 'Modrinth override entry');
          const srcPath = resolvePathWithinRoot(src, safeName, 'Modrinth override source');
          const destPath = resolvePathWithinRoot(dest, safeName, 'Modrinth override destination');
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
      missing,
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
