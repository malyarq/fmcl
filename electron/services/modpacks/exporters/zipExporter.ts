import fs from 'node:fs';
import path from 'node:path';
import { SafeZipWriter } from '../../../security/zipWriter';

/**
 * Экспорт модпака в простой ZIP архив со всеми файлами
 */
export async function exportToZip(
  modpackDir: string,
  outputPath: string,
): Promise<void> {
  const zip = new SafeZipWriter();

  // Добавить все файлы и папки из модпака
  addDirectoryToZip(zip, modpackDir, '');

  // Сохранить ZIP
  await zip.writeTo(outputPath);
}

/**
 * Рекурсивно добавить директорию в ZIP
 */
function addDirectoryToZip(zip: SafeZipWriter, dirPath: string, zipPath: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  // Игнорировать некоторые файлы
  const ignoreFiles = ['modpack.json', '.DS_Store', 'thumbs.db'];

  for (const entry of entries) {
    if (ignoreFiles.includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const zipEntryPath = zipPath ? path.join(zipPath, entry.name).replace(/\\/g, '/') : entry.name;

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, zipEntryPath);
    } else {
      zip.addFile(zipEntryPath, fullPath);
    }
  }
}
