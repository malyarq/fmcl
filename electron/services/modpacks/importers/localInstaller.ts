import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { parseCurseForgeManifest } from '../parsers/curseforgeParser';
import { parseModrinthManifest } from '../parsers/modrinthParser';
import type { ModpackManifest } from '../../../../shared/types/modpack';

/**
 * Определить формат модпака по файлу
 */
export function detectModpackFormat(filePath: string): 'curseforge' | 'modrinth' | 'zip' | null {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.mrpack') {
    return 'modrinth';
  }
  
  // Попробовать открыть как ZIP и проверить содержимое
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    
    // Проверить наличие modrinth.index.json
    if (entries.some((e) => e.entryName === 'modrinth.index.json')) {
      return 'modrinth';
    }
    
    // Проверить наличие manifest.json
    if (entries.some((e) => e.entryName === 'manifest.json')) {
      return 'curseforge';
    }
    
    // Если это ZIP, но нет манифеста - это простой ZIP
    return 'zip';
  } catch {
    return null;
  }
}

/**
 * Получить информацию о модпаке из файла (без импорта)
 */
export function getModpackInfoFromFile(filePath: string): {
  format: 'curseforge' | 'modrinth' | 'zip' | null;
  manifest: ModpackManifest | null;
  error?: string;
} {
  try {
    const format = detectModpackFormat(filePath);
    
    if (!format) {
      return { format: null, manifest: null, error: 'Unable to detect modpack format' };
    }

    const zip = new AdmZip(filePath);
    let manifest: ModpackManifest | null = null;

    if (format === 'curseforge') {
      const manifestEntry = zip.getEntry('manifest.json');
      if (!manifestEntry) {
        return { format, manifest: null, error: 'CurseForge modpack missing manifest.json' };
      }
      const manifestJson = manifestEntry.getData().toString('utf-8');
      manifest = parseCurseForgeManifest(manifestJson);
    } else if (format === 'modrinth') {
      const manifestEntry = zip.getEntry('modrinth.index.json');
      if (!manifestEntry) {
        return { format, manifest: null, error: 'Modrinth modpack missing modrinth.index.json' };
      }
      const manifestJson = manifestEntry.getData().toString('utf-8');
      manifest = parseModrinthManifest(manifestJson);
    } else {
      // Для ZIP попробовать найти манифест
      const manifestEntry = zip.getEntry('manifest.json');
      if (manifestEntry) {
        const manifestJson = manifestEntry.getData().toString('utf-8');
        manifest = parseCurseForgeManifest(manifestJson);
      }
    }

    return { format, manifest };
  } catch (error) {
    return { format: null, manifest: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Импорт модпака из файла
 */
export async function importModpack(
  filePath: string,
  targetDir: string,
): Promise<{
  manifest: ModpackManifest;
  format: 'curseforge' | 'modrinth' | 'zip';
}> {
  const format = detectModpackFormat(filePath);
  
  if (!format) {
    throw new Error('Unable to detect modpack format');
  }

  const zip = new AdmZip(filePath);
  
  // Создать целевую директорию
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let manifest: ModpackManifest;

  if (format === 'curseforge') {
    // Извлечь manifest.json
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      throw new Error('CurseForge modpack missing manifest.json');
    }
    
    const manifestJson = manifestEntry.getData().toString('utf-8');
    manifest = parseCurseForgeManifest(manifestJson);
    
    // Извлечь overrides
    const overridesDir = path.join(targetDir, manifest.overrides || 'overrides');
    extractOverrides(zip, overridesDir, 'overrides');
    
  } else if (format === 'modrinth') {
    // Извлечь modrinth.index.json
    const manifestEntry = zip.getEntry('modrinth.index.json');
    if (!manifestEntry) {
      throw new Error('Modrinth modpack missing modrinth.index.json');
    }
    
    const manifestJson = manifestEntry.getData().toString('utf-8');
    manifest = parseModrinthManifest(manifestJson);
    
    // Извлечь все файлы из манифеста
    for (const file of manifest.files) {
      if (file.path) {
        const fileEntry = zip.getEntry(file.path);
        if (fileEntry) {
          const targetPath = path.join(targetDir, file.path);
          const targetDirPath = path.dirname(targetPath);
          
          if (!fs.existsSync(targetDirPath)) {
            fs.mkdirSync(targetDirPath, { recursive: true });
          }
          
          fs.writeFileSync(targetPath, fileEntry.getData());
        }
      }
    }
    
    // Извлечь overrides
    extractOverrides(zip, path.join(targetDir, 'overrides'), 'overrides');
    
  } else {
    // Простой ZIP - извлечь все
    zip.extractAllTo(targetDir, true);
    
    // Попробовать найти манифест
    const manifestPath = path.join(targetDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifestJson = fs.readFileSync(manifestPath, 'utf-8');
      manifest = parseCurseForgeManifest(manifestJson);
    } else {
      // Создать базовый манифест
      manifest = {
        formatVersion: 1,
        minecraft: {
          version: '1.20.1',
          modLoaders: [],
        },
        name: path.basename(targetDir),
        version: '1.0.0',
        files: [],
      };
    }
  }

  return { manifest, format };
}

/**
 * Извлечь overrides из ZIP
 */
function extractOverrides(zip: AdmZip, targetDir: string, zipPath: string): void {
  const entries = zip.getEntries();
  
  for (const entry of entries) {
    if (entry.entryName.startsWith(zipPath + '/') && entry.entryName !== zipPath + '/') {
      const relativePath = entry.entryName.substring(zipPath.length + 1);
      const targetPath = path.join(targetDir, relativePath);
      const targetDirPath = path.dirname(targetPath);
      
      if (!fs.existsSync(targetDirPath)) {
        fs.mkdirSync(targetDirPath, { recursive: true });
      }
      
      if (!entry.isDirectory) {
        fs.writeFileSync(targetPath, entry.getData());
      }
    }
  }
}
