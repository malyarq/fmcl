import fs from 'fs';
import path from 'path';
import type { ModpackService } from '../../modpacks/modpackService';

export function resolveRootAndModpack(params: {
  modpacks: ModpackService;
  options: {
    gamePath?: string;
    modpackId?: string;
    modpackPath?: string;
  };
}) {
  const { modpacks, options } = params;

  // `rootPath` is the shared Minecraft "resource" location (assets/libraries/versions).
  const rootPath = options.gamePath || modpacks.getDefaultRootPath();
  modpacks.ensureXmclFolders(rootPath);
  modpacks.ensureModpacksMigrated(rootPath);

  // Modpack directory is the per-modpack "game" directory (mods/saves/config).
  // This keeps modpacks isolated while still sharing the heavy runtime cache.
  let modpackPath = options.modpackPath?.trim() || '';
  let modpackId = options.modpackId?.trim() || '';
  if (!modpackPath) {
    const selected = modpackId || modpacks.getSelectedModpackId(rootPath);
    modpackId = selected;
    // Persist selection when the caller explicitly passes modpackId.
    if (options.modpackId) {
      try {
        modpacks.setSelectedModpack(rootPath, selected);
      } catch {
        /* ignore */
      }
    }
    modpackPath = modpacks.getModpackDir(rootPath, selected);
  }

  try {
    fs.mkdirSync(modpackPath, { recursive: true });
    fs.mkdirSync(path.join(modpackPath, 'mods'), { recursive: true });
  } catch {
    // ignore
  }

  return { rootPath, modpackId, modpackPath };
}

// Legacy alias for backward compatibility
export const resolveRootAndInstance = resolveRootAndModpack;

