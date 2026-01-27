import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { download } from '@xmcl/file-transfer';
import AdmZip from 'adm-zip';
import { CurseforgeV1Client } from '@xmcl/curseforge';
import { ModpackService } from '../modpackService';
import { parseCurseForgeManifest } from '../parsers/curseforgeParser';
import { ensureDir } from '../../mods/platform/fsUtils';
import type { ModpackMetadata } from '@shared/types/modpack';
import { createModpackMetadataFromConfig } from '../storage';

export interface CurseForgeModpackInstallOptions {
  projectId: number;
  fileId: number;
  targetModpackId?: string;
  rootPath?: string;
  onProgress?: (progress: { downloaded: number; total: number; stage: string }) => void;
}

export interface CurseForgeModpackInstallResult {
  modpackId: string;
  config: unknown;
  metadata: ModpackMetadata;
}

/**
 * Установка модпака с CurseForge
 */
export async function downloadCurseForgeModpack(
  curseforge: CurseforgeV1Client,
  modpackService: ModpackService,
  options: CurseForgeModpackInstallOptions,
): Promise<CurseForgeModpackInstallResult> {
  const { projectId, fileId, targetModpackId, rootPath, onProgress } = options;
  const root = rootPath ?? modpackService.getDefaultRootPath();
  modpackService.ensureModpacksMigrated(root);

  onProgress?.({ downloaded: 0, total: 100, stage: 'Получение информации о модпаке...' });

  // Получить информацию о файле модпака
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
      url: downloadUrl,
      destination: tempZipPath,
      validator: sha1 ? { algorithm: 'sha1', hash: sha1 } : undefined,
    });

    onProgress?.({ downloaded: 30, total: 100, stage: 'Распаковка модпака...' });

    // Распаковать ZIP
    const zip = new AdmZip(tempZipPath);
    const extractDir = path.join(tempDir, 'extracted');
    zip.extractAllTo(extractDir, true);

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

    for (const file of manifest.files) {
      if (!file.projectID || !file.fileID) {
        console.warn(`Skipping mod: missing projectID or fileID`);
        continue;
      }
      try {
        const modFile = await curseforge.getModFile(file.projectID, file.fileID);
        const modDownloadUrl = modFile.downloadUrl;
        if (!modDownloadUrl) {
          console.warn(`Skipping mod ${file.projectID}/${file.fileID}: no download URL`);
          continue;
        }

        const modDestination = path.join(modsDir, modFile.fileName);
        const modSha1 = modFile.hashes?.find((h) => h.algo === 1 /* sha1 */)?.value;

        await download({
          url: modDownloadUrl,
          destination: modDestination,
          validator: modSha1 ? { algorithm: 'sha1', hash: modSha1 } : undefined,
        });

        installedMods++;
        onProgress?.({
          downloaded: 50 + Math.floor((installedMods / totalMods) * 40),
          total: 100,
          stage: `Установка модов (${installedMods}/${totalMods})...`,
        });
      } catch (error) {
        console.error(`Failed to install mod ${file.projectID}/${file.fileID}:`, error);
        // Продолжаем установку других модов даже если один не удался
      }
    }

    onProgress?.({ downloaded: 90, total: 100, stage: 'Копирование конфигов...' });

    // Скопировать overrides
    const overridesDir = path.join(extractDir, manifest.overrides || 'overrides');
    if (fs.existsSync(overridesDir)) {
      // Рекурсивно скопировать все файлы из overrides
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
