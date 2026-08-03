import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { download } from '@xmcl/file-transfer';
import { CurseforgeV1Client } from '@xmcl/curseforge';
import { ModpackService } from '../modpackService';
import { parseCurseForgeManifest } from '../parsers/curseforgeParser';
import { ensureDir } from '../../mods/platform/fsUtils';
import type { ModpackMetadata } from '@shared/types/modpack';
import { createModpackMetadataFromConfig } from '../storage';
import { extractZipSafely, openValidatedZip } from '../../../security/archivePolicy';
import { assertChildName, resolvePathWithinRoot } from '../../../security/pathGuards';
import { assertPublicHttpsUrl } from '../../../security/remoteUrls';

export interface CurseForgeModpackInstallOptions {
  projectId: number;
  fileId: number;
  targetModpackId?: string;
  rootPath?: string;
  onProgress?: (progress: { downloaded: number; total: number; stage: string }) => void;
  checkCancelled?: () => void;
}

export interface CurseForgeModpackInstallResult {
  modpackId: string;
  config: unknown;
  metadata: ModpackMetadata;
  missing: Array<{ path: string; reason: string }>;
}

/**
 * Установка модпака с CurseForge
 */
export async function downloadCurseForgeModpack(
  curseforge: CurseforgeV1Client,
  modpackService: ModpackService,
  options: CurseForgeModpackInstallOptions,
): Promise<CurseForgeModpackInstallResult> {
  const { projectId, fileId, targetModpackId, rootPath, onProgress, checkCancelled } = options;
  const throwIfCancelled = () => checkCancelled?.();
  const root = rootPath ?? modpackService.getDefaultRootPath();
  modpackService.ensureModpacksMigrated(root);

  onProgress?.({ downloaded: 0, total: 100, stage: 'Получение информации о модпаке...' });

  // Получить информацию о файле модпака
  throwIfCancelled();
  const modpackFile = await curseforge.getModFile(projectId, fileId);
  const downloadUrl = modpackFile.downloadUrl;
  if (!downloadUrl) {
    throw new Error('CurseForge modpack file has no downloadUrl');
  }

  // Получить информацию о модпаке для метаданных
  const modpackInfo = await curseforge.getMod(projectId);

  onProgress?.({ downloaded: 10, total: 100, stage: 'Скачивание модпака...' });

  // Скачать ZIP архив во временную папку
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modpack-'));
  const tempZipPath = path.join(tempDir, 'modpack.zip');

  try {
    const sha1 = modpackFile.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value;
    await download({
      url: assertPublicHttpsUrl(downloadUrl, 'CurseForge modpack download URL'),
      destination: tempZipPath,
      validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
    });
    throwIfCancelled();

    onProgress?.({ downloaded: 30, total: 100, stage: 'Распаковка модпака...' });

    // Распаковать ZIP
    const zip = await openValidatedZip(tempZipPath, 'CurseForge modpack');
    const extractDir = path.join(tempDir, 'extracted');
    try {
      await extractZipSafely(zip, extractDir);
    } finally {
      zip.close();
    }

    onProgress?.({ downloaded: 40, total: 100, stage: 'Парсинг манифеста...' });

    // Найти и распарсить manifest.json
    const manifestPath = path.join(extractDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('CurseForge modpack does not contain manifest.json');
    }

    const manifestJson = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = parseCurseForgeManifest(manifestJson);

    // Определить модлоадер
    const primaryLoader = manifest.minecraft.modLoaders.find((l) => l.primary);
    const loaderId = primaryLoader?.id || manifest.minecraft.modLoaders[0]?.id || '';
    const loaderType = loaderId.includes('forge') ? 'forge' : loaderId.includes('fabric') ? 'fabric' : loaderId.includes('quilt') ? 'quilt' : loaderId.includes('neoforge') ? 'neoforge' : 'vanilla';
    const loaderVersion = loaderId.split('-')[1];

    // Создать модпак
    const modpackName = targetModpackId || manifest.name || modpackInfo.name;
    const { id: modpackId, config } = modpackService.createModpack(root, modpackName, {
      runtime: {
        minecraft: manifest.minecraft.version,
        modLoader: loaderType !== 'vanilla' ? { type: loaderType, version: loaderVersion } : undefined,
      },
    });

    const modpackDir = modpackService.getModpackDir(root, modpackId);

    onProgress?.({ downloaded: 50, total: 100, stage: 'Установка модов...' });

    // Установить все моды из манифеста
    const modsDir = path.join(modpackDir, 'mods');
    ensureDir(modsDir);

    const totalMods = manifest.files.length;
    let installedMods = 0;
    const missing: Array<{ path: string; reason: string }> = [];

    for (const file of manifest.files) {
      const missingPath = `curseforge:${file.projectID ?? 'missing'}/${file.fileID ?? 'missing'}`;
      if (!file.projectID || !file.fileID) {
        if (file.required) throw new Error(`Required CurseForge file is missing identifiers: ${missingPath}`);
        missing.push({ path: missingPath, reason: 'provider file identifiers are missing' });
        continue;
      }
      try {
        throwIfCancelled();
        const modFile = await curseforge.getModFile(file.projectID, file.fileID);
        const modDownloadUrl = modFile.downloadUrl;
        if (!modDownloadUrl) {
          throw new Error('provider did not return a download URL');
        }

        const modDestination = resolvePathWithinRoot(modsDir, assertChildName(modFile.fileName, 'CurseForge mod filename'), 'CurseForge mod destination');
        const modSha1 = modFile.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value;

        await download({
          url: assertPublicHttpsUrl(modDownloadUrl, `CurseForge mod ${file.projectID}/${file.fileID} download URL`),
          destination: modDestination,
          validator: modSha1 ? { algorithm: 'sha1', hash: modSha1 } : undefined,
        });

        throwIfCancelled();
        installedMods++;
        onProgress?.({
          downloaded: 50 + Math.floor((installedMods / totalMods) * 40),
          total: 100,
          stage: `Установка модов (${installedMods}/${totalMods})...`,
        });
      } catch (error) {
        if (file.required) throw error;
        missing.push({ path: missingPath, reason: error instanceof Error ? error.message : 'optional provider download failed' });
      }
    }

    onProgress?.({ downloaded: 90, total: 100, stage: 'Копирование конфигов...' });

    // Скопировать overrides
    const overridesDir = resolvePathWithinRoot(extractDir, manifest.overrides || 'overrides', 'CurseForge overrides directory');
    if (fs.existsSync(overridesDir)) {
      // Рекурсивно скопировать все файлы из overrides
      const copyRecursive = (src: string, dest: string) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          throwIfCancelled();
          const safeName = assertChildName(entry.name, 'CurseForge override entry');
          const srcPath = resolvePathWithinRoot(src, safeName, 'CurseForge override source');
          const destPath = resolvePathWithinRoot(dest, safeName, 'CurseForge override destination');
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
    const modpackManifestPath = path.join(modpackDir, 'manifest.json');
    fs.copyFileSync(manifestPath, modpackManifestPath);

    onProgress?.({ downloaded: 95, total: 100, stage: 'Создание метаданных...' });

    // Создать метаданные
    const metadata = createModpackMetadataFromConfig(
      config,
      'curseforge',
      String(projectId),
      String(fileId),
    );

    // Обновить метаданные с информацией из API
    const updatedMetadata = {
      ...metadata,
      name: modpackInfo.name,
      version: manifest.version,
      description: modpackInfo.summary,
      iconUrl: modpackInfo.logo?.thumbnailUrl,
      author: manifest.author || (modpackInfo.authors && Array.isArray(modpackInfo.authors) 
        ? modpackInfo.authors.map((a: { name?: string }) => a.name || '').filter(Boolean).join(', ')
        : undefined),
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
