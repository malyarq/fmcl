import fs from 'node:fs';
import path from 'node:path';
import { groupByFile, formatModLine } from './format';
import { scanModsFolder } from './scanner';

/**
 * Checks and logs installed mods and versions.
 *
 * Domain: mods service (main process).
 */
export async function logInstalledMods(
  minecraftRootPath: string,
  onLog: (data: string) => void,
  gamePath?: string
) {
  const versionsPath = path.join(minecraftRootPath, 'versions');
  if (fs.existsSync(versionsPath)) {
    try {
      const versionDirs = fs
        .readdirSync(versionsPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      const fabricVersions = versionDirs.filter((v) => v.toLowerCase().includes('fabric'));
      if (fabricVersions.length > 0) {
        onLog(`[VERSIONS] Fabric versions found: ${fabricVersions.join(', ')}`);
      }

      const forgeVersions = versionDirs.filter(
        (v) => v.toLowerCase().includes('forge') && !v.toLowerCase().includes('neoforge')
      );
      if (forgeVersions.length > 0) {
        onLog(`[VERSIONS] Forge versions found: ${forgeVersions.join(', ')}`);
      }

      const neoForgeVersions = versionDirs.filter((v) => v.toLowerCase().includes('neoforge'));
      if (neoForgeVersions.length > 0) {
        onLog(`[VERSIONS] NeoForge versions found: ${neoForgeVersions.join(', ')}`);
      }
    } catch (e: unknown) {
      const errorMsg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : String(e);
      onLog(`[VERSIONS] Error checking versions: ${errorMsg || e}`);
    }
  }

  const modsPath = path.join(gamePath ?? minecraftRootPath, 'mods');

  if (!fs.existsSync(modsPath)) {
    onLog(`[MODS] mods folder not found - no mods installed`);
    return;
  }

  try {
    const mods = await scanModsFolder(modsPath);
    if (mods.length === 0) {
      onLog(`[MODS] No .jar files in mods folder`);
      return;
    }

    const byFile = groupByFile(mods);
    onLog(`[MODS] Found ${byFile.size} mod file(s), ${mods.length} mod entry(s)`);

    // Print each file with its parsed modids/versions.
    for (const [filePath, entries] of byFile.entries()) {
      const fileName = path.basename(filePath);
      const lines = entries.map((m) => formatModLine(m));
      onLog(`[MODS] ${fileName}: ${lines.join(' | ')}`);
    }
  } catch (e: unknown) {
    const errorMsg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message: unknown }).message)
        : String(e);
    onLog(`[MODS] Error checking mods: ${errorMsg || e}`);
  }
}

