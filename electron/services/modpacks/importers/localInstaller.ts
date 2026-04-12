import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { assertAbsolutePath, assertRelativePath, resolvePathWithinRoot } from '../../../security/pathGuards';
import { resolveApprovedInstancePath } from '../../instances/paths';
import { parseCurseForgeManifest } from '../parsers/curseforgeParser';
import { parseModrinthManifest } from '../parsers/modrinthParser';
import type { ModpackManifest } from '../../../../shared/types/modpack';

type ZipEntry = ReturnType<AdmZip['getEntries']>[number];

type ArchiveWriteTask = {
  entry: ZipEntry;
  targetPath: string;
};

function normalizeArchiveRelativePath(value: string, label: string): string {
  const trimmedValue = value.replace(/[\\/]+$/, '');
  if (!trimmedValue) {
    throw new Error(`${label} must stay inside the launcher root`);
  }

  return assertRelativePath(trimmedValue, label).split(path.sep).join('/');
}

function collectZipExtractionTasks(zip: AdmZip, targetDir: string): ArchiveWriteTask[] {
  const safeTargetDir = resolveApprovedInstancePath(targetDir);
  const tasks: ArchiveWriteTask[] = [];

  for (const entry of zip.getEntries()) {
    const normalizedEntryPath = normalizeArchiveRelativePath(entry.entryName, 'Archive entry path');
    const targetPath = resolvePathWithinRoot(
      safeTargetDir,
      normalizedEntryPath,
      `Archive entry "${entry.entryName}"`,
    );

    if (!entry.isDirectory) {
      tasks.push({ entry, targetPath });
    }
  }

  return tasks;
}

function buildZipEntryLookup(zip: AdmZip): Map<string, ZipEntry> {
  const entryMap = new Map<string, ZipEntry>();

  for (const entry of zip.getEntries()) {
    const normalizedEntryPath = normalizeArchiveRelativePath(entry.entryName, 'Archive entry path');
    const existingEntry = entryMap.get(normalizedEntryPath);

    if (!existingEntry || existingEntry.isDirectory) {
      entryMap.set(normalizedEntryPath, entry);
    }
  }

  return entryMap;
}

function writeArchiveTasks(tasks: ArchiveWriteTask[]): void {
  for (const task of tasks) {
    fs.mkdirSync(path.dirname(task.targetPath), { recursive: true });
    fs.writeFileSync(task.targetPath, task.entry.getData());
  }
}

/**
 * Определить формат модпака по файлу
 */
/**
 * Определить формат модпака по файлу
 */
export function detectModpackFormat(filePath: string): 'curseforge' | 'modrinth' | 'zip' | 'multimc' | null {
  const safeFilePath = assertAbsolutePath(filePath, 'Modpack file path');
  const ext = path.extname(safeFilePath).toLowerCase();

  if (ext === '.mrpack') {
    return 'modrinth';
  }

  // Попробовать открыть как ZIP и проверить содержимое
  try {
    const zip = new AdmZip(safeFilePath);
    const entries = zip.getEntries();

    // Проверить наличие modrinth.index.json
    if (entries.some((e) => e.entryName === 'modrinth.index.json')) {
      return 'modrinth';
    }

    // Проверить наличие manifest.json
    if (entries.some((e) => e.entryName === 'manifest.json')) {
      return 'curseforge';
    }

    // Проверить наличие mmc-pack.json (в корне или глубже)
    if (entries.some((e) => e.entryName.endsWith('mmc-pack.json') && !e.entryName.includes('__MACOSX'))) {
      return 'multimc';
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
  format: 'curseforge' | 'modrinth' | 'zip' | 'multimc' | null;
  manifest: ModpackManifest | null;
  error?: string;
} {
  try {
    const safeFilePath = assertAbsolutePath(filePath, 'Modpack file path');
    const format = detectModpackFormat(safeFilePath);

    if (!format) {
      return { format: null, manifest: null, error: 'Unable to detect modpack format' };
    }

    const zip = new AdmZip(safeFilePath);
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
    } else if (format === 'multimc') {
      // Find mmc-pack.json
      const entry = zip.getEntries().find(e => e.entryName.endsWith('mmc-pack.json') && !e.entryName.includes('__MACOSX'));
      if (!entry) {
        return { format, manifest: null, error: 'MultiMC pack missing mmc-pack.json' };
      }

      const mmcPack = JSON.parse(entry.getData().toString('utf-8'));
      const components = mmcPack.components || [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mcComponent = components.find((c: any) => c.uid === 'net.minecraft');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const forge = components.find((c: any) => c.uid === 'net.minecraftforge');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fabric = components.find((c: any) => c.uid === 'net.fabricmc.fabric-loader');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quilt = components.find((c: any) => c.uid === 'org.quiltmc.quilt-loader');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const neoforge = components.find((c: any) => c.uid === 'net.neoforged.neoforge');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loaders: any[] = [];
      if (forge) loaders.push({ id: `forge-${forge.version}`, primary: true });
      if (fabric) loaders.push({ id: `fabric-${fabric.version}`, primary: true });
      if (quilt) loaders.push({ id: `quilt-${quilt.version}`, primary: true });
      if (neoforge) loaders.push({ id: `neoforge-${neoforge.version}`, primary: true });

      // Count mods
      const modsCount = zip.getEntries().filter(e => !e.isDirectory && (e.entryName.includes('/mods/') || e.entryName.startsWith('mods/')) && e.entryName.endsWith('.jar')).length;

      // Try to find instance.cfg for Name
      const cfgEntry = zip.getEntries().find(e => e.entryName.endsWith('instance.cfg') && !e.entryName.includes('__MACOSX'));
      let name = path.basename(safeFilePath, path.extname(safeFilePath));
      if (cfgEntry) {
        const cfg = cfgEntry.getData().toString('utf-8');
        const nameMatch = cfg.match(/name=(.*)/);
        if (nameMatch) name = nameMatch[1];
      }

      manifest = {
        formatVersion: 1,
        minecraft: {
          version: mcComponent?.version || 'Unknown',
          modLoaders: loaders
        },
        name: name,
        version: '1.0.0', // MultiMC packs rarely have explicit version in pack.json
        files: new Array(modsCount).fill({ required: true }), // Dummy array to show count
        author: 'MultiMC Export'
      };

    } else {
      // Для ZIP попробовать найти манифест
      const manifestEntry = zip.getEntry('manifest.json');
      if (manifestEntry) {
        const manifestJson = manifestEntry.getData().toString('utf-8');
        manifest = parseCurseForgeManifest(manifestJson);
      } else {
        // Basic zip
        manifest = {
          formatVersion: 1,
          minecraft: {
            version: 'Unknown',
          modLoaders: []
        },
          name: path.basename(safeFilePath, path.extname(safeFilePath)),
          version: '1.0.0',
          files: []
        }
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
  format: 'curseforge' | 'modrinth' | 'zip' | 'multimc';
}> {
  const safeFilePath = assertAbsolutePath(filePath, 'Modpack file path');
  const safeTargetDir = resolveApprovedInstancePath(targetDir);
  const format = detectModpackFormat(safeFilePath);

  if (!format) {
    throw new Error('Unable to detect modpack format');
  }

  const zip = new AdmZip(safeFilePath);

  // Создать целевую директорию
  if (!fs.existsSync(safeTargetDir)) {
    fs.mkdirSync(safeTargetDir, { recursive: true });
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
    const overridesDir = resolvePathWithinRoot(
      safeTargetDir,
      manifest.overrides || 'overrides',
      'Overrides directory',
    );
    extractOverrides(zip, overridesDir, manifest.overrides || 'overrides');

  } else if (format === 'modrinth') {
    // Извлечь modrinth.index.json
    const manifestEntry = zip.getEntry('modrinth.index.json');
    if (!manifestEntry) {
      throw new Error('Modrinth modpack missing modrinth.index.json');
    }

    const manifestJson = manifestEntry.getData().toString('utf-8');
    manifest = parseModrinthManifest(manifestJson);

    // Извлечь все файлы из манифеста
    const zipEntries = buildZipEntryLookup(zip);
    const fileTasks: ArchiveWriteTask[] = [];

    for (const file of manifest.files) {
      if (file.path) {
        const normalizedFilePath = normalizeArchiveRelativePath(file.path, 'Modrinth file path');
        const fileEntry = zipEntries.get(normalizedFilePath);
        if (fileEntry && !fileEntry.isDirectory) {
          fileTasks.push({
            entry: fileEntry,
            targetPath: resolvePathWithinRoot(
              safeTargetDir,
              normalizedFilePath,
              `Modrinth file "${file.path}"`,
            ),
          });
        }
      }
    }

    writeArchiveTasks(fileTasks);

    // Извлечь overrides
    extractOverrides(
      zip,
      resolvePathWithinRoot(safeTargetDir, 'overrides', 'Overrides directory'),
      'overrides',
    );

  } else {
    // Простой ZIP - извлечь все
    writeArchiveTasks(collectZipExtractionTasks(zip, safeTargetDir));

    // Попробовать найти манифест
    const manifestPath = resolvePathWithinRoot(safeTargetDir, 'manifest.json', 'Manifest path');
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
  const safeTargetDir = assertAbsolutePath(targetDir, 'Overrides directory');
  const safeZipPath = normalizeArchiveRelativePath(zipPath, 'Archive overrides path');
  const tasks: ArchiveWriteTask[] = [];

  for (const entry of zip.getEntries()) {
    const normalizedEntryPath = normalizeArchiveRelativePath(entry.entryName, 'Archive entry path');
    if (
      normalizedEntryPath !== safeZipPath
      && !normalizedEntryPath.startsWith(`${safeZipPath}/`)
    ) {
      continue;
    }

    const relativePath = normalizedEntryPath === safeZipPath
      ? ''
      : normalizedEntryPath.slice(safeZipPath.length + 1);

    if (!relativePath || entry.isDirectory) {
      continue;
    }

    tasks.push({
      entry,
      targetPath: resolvePathWithinRoot(
        safeTargetDir,
        relativePath,
        `Archive entry "${entry.entryName}"`,
      ),
    });
  }

  writeArchiveTasks(tasks);
}
