import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type { CurseForgeManifest } from '../../../../shared/types/modpack';
import { generateManifestFromInstance } from './manifestGenerator';
import type { ModPlatformService } from '../../mods/platform/modPlatformService';

/**
 * Экспорт модпака в формат CurseForge (ZIP с manifest.json и overrides/)
 */
export async function exportToCurseForge(
  modpackDir: string,
  modpackName: string,
  modpackVersion: string,
  author: string | undefined,
  outputPath: string,
  platformService?: ModPlatformService,
): Promise<void> {
  // Генерировать манифест
  const manifest = await generateManifestFromInstance(
    modpackDir,
    modpackName,
    modpackVersion,
    author,
    platformService,
  );

  // Преобразовать в формат CurseForge
  const curseForgeManifest: CurseForgeManifest = {
    manifestVersion: manifest.formatVersion,
    manifestType: 'minecraftModpack',
    minecraft: {
      version: manifest.minecraft.version,
      modLoaders: manifest.minecraft.modLoaders,
    },
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    files: manifest.files
      .filter((f) => f.projectID && f.fileID) // Только файлы с CurseForge ID
      .map((f) => ({
        projectID: f.projectID!,
        fileID: f.fileID!,
        required: f.required ?? true,
      })),
    overrides: manifest.overrides || 'overrides',
  };

  // Создать ZIP архив
  const zip = new AdmZip();

  // Добавить manifest.json
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(curseForgeManifest, null, 2)));

  // Добавить overrides (если есть)
  const overridesDir = path.join(modpackDir, manifest.overrides || 'overrides');
  if (fs.existsSync(overridesDir)) {
    // Добавить всю папку overrides
    addDirectoryToZip(zip, overridesDir, 'overrides');
  } else {
    // Если нет папки overrides, но есть отдельные папки, добавить их
    const overrideDirs = ['config', 'resourcepacks', 'shaderpacks', 'saves', 'scripts'];
    
    for (const dir of overrideDirs) {
      const dirPath = path.join(modpackDir, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        addDirectoryToZip(zip, dirPath, path.join('overrides', dir));
      }
    }
  }

  // Сохранить ZIP
  zip.writeZip(outputPath);
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
