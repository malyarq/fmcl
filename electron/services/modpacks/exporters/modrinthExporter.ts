import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import type { ModrinthManifest } from '../../../../shared/types/modpack';
import { generateManifestFromInstance } from './manifestGenerator';
import type { ModPlatformService } from '../../mods/platform/modPlatformService';

/**
 * Вычислить SHA1 хеш файла
 */
function sha1OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Вычислить SHA512 хеш файла
 */
function sha512OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha512');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Экспорт модпака в формат Modrinth (.mrpack)
 */
export async function exportToModrinth(
  modpackDir: string,
  modpackName: string,
  modpackVersion: string,
  versionId: string,
  outputPath: string,
  platformService?: ModPlatformService,
): Promise<void> {
  // Генерировать манифест
  const manifest = await generateManifestFromInstance(
    modpackDir,
    modpackName,
    modpackVersion,
    undefined,
    platformService,
  );

  // Собрать все файлы для Modrinth манифеста
  const files: ModrinthManifest['files'] = [];

  // Обработать моды
  for (const file of manifest.files) {
    if (file.path) {
      const filePath = path.join(modpackDir, file.path);
      if (fs.existsSync(filePath)) {
        const [sha1, sha512] = await Promise.all([
          sha1OfFile(filePath),
          sha512OfFile(filePath),
        ]);
        const stats = fs.statSync(filePath);

        // Для Modrinth нужно указать URL для скачивания
        // В экспорте мы не можем предоставить реальные URL, поэтому оставляем пустым
        // Пользователь должен будет загрузить файлы отдельно или использовать другой формат
        files.push({
          path: file.path.replace(/\\/g, '/'), // Нормализовать пути
          hashes: {
            sha1,
            sha512,
          },
          downloads: [], // Пусто - файлы должны быть загружены отдельно
          fileSize: stats.size,
          env: {
            client: file.required ? 'required' : 'optional',
            server: 'optional',
          },
        });
      }
    } else if (file.projectId && file.versionId && platformService) {
      // Мод с Modrinth - получить информацию из API
      try {
        const modrinth = platformService.getModrinthClient();
        const version = await modrinth.getProjectVersion(file.versionId as string);
        const primaryFile = version.files.find((f) => f.primary) || version.files[0];
        
        if (primaryFile) {
          files.push({
            path: primaryFile.filename,
            hashes: {
              sha1: primaryFile.hashes?.sha1 || '',
              sha512: primaryFile.hashes?.sha512 || '',
            },
            downloads: [primaryFile.url],
            fileSize: primaryFile.size,
            env: {
              client: file.required ? 'required' : 'optional',
              server: 'optional',
            },
          });
        }
      } catch (error) {
        console.warn(`Failed to get Modrinth file info for ${file.projectId}/${file.versionId}:`, error);
        // Пропускаем мод, если не удалось получить информацию
      }
    }
  }

  // Добавить файлы из overrides
  const overridesDir = path.join(modpackDir, manifest.overrides || 'overrides');
  if (fs.existsSync(overridesDir)) {
    await addOverridesToManifest(files, overridesDir, modpackDir);
  }

  // Создать Modrinth манифест
  const modrinthManifest: ModrinthManifest = {
    formatVersion: 1,
    game: 'minecraft',
    versionId,
    name: modpackName,
    summary: undefined,
    files,
  };

  // Создать ZIP архив
  const zip = new AdmZip();

  // Добавить modrinth.index.json
  zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(modrinthManifest, null, 2)));

  // Добавить все файлы модпака в архив
  for (const file of files) {
    if (file.path && file.downloads.length === 0) {
      // Локальный файл - добавить в архив
      const filePath = path.join(modpackDir, file.path);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath);
        zip.addFile(file.path.replace(/\\/g, '/'), content);
      }
    }
  }

  // Добавить overrides
  if (fs.existsSync(overridesDir)) {
    addDirectoryToZip(zip, overridesDir, 'overrides');
  }

  // Сохранить ZIP
  zip.writeZip(outputPath);
}

/**
 * Добавить файлы из overrides в манифест
 */
async function addOverridesToManifest(
  files: ModrinthManifest['files'],
  overridesDir: string,
  modpackDir: string,
): Promise<void> {
  const entries = fs.readdirSync(overridesDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(overridesDir, entry.name);
    const relativePath = path.relative(modpackDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      await addOverridesToManifest(files, fullPath, modpackDir);
    } else {
      const [sha1, sha512] = await Promise.all([
        sha1OfFile(fullPath),
        sha512OfFile(fullPath),
      ]);
      const stats = fs.statSync(fullPath);

      files.push({
        path: relativePath,
        hashes: {
          sha1,
          sha512,
        },
        downloads: [],
        fileSize: stats.size,
        env: {
          client: 'required',
          server: 'optional',
        },
      });
    }
  }
}

/**
 * Рекурсивно добавить директорию в ZIP
 */
function addDirectoryToZip(zip: AdmZip, dirPath: string, zipPath: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const zipEntryPath = path.join(zipPath, entry.name).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipEntryPath);
    } else {
      const content = fs.readFileSync(fullPath);
      zip.addFile(zipEntryPath, content);
    }
  }
}
