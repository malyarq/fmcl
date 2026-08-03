import fs from 'fs';
import path from 'path';
import { CLASSIC_MODPACK_ID } from '../../../../shared/constants';
import type { ModpackService } from '../../modpacks/modpackService';
import { resolveApprovedInstancePath, resolveApprovedLauncherRootPath } from '../../instances/paths';

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
  const rootPath = resolveApprovedLauncherRootPath(options.gamePath || modpacks.getDefaultRootPath());
  modpacks.ensureXmclFolders(rootPath);
  modpacks.ensureModpacksMigrated(rootPath);

  // Modpack directory is the per-modpack "game" directory (mods/saves/config).
  // This keeps modpacks isolated while still sharing the heavy runtime cache.
  let modpackPath = options.modpackPath?.trim() || '';
  let modpackId = options.modpackId?.trim() || '';
  if (modpackPath) {
    const safeModpackPath = resolveApprovedInstancePath(modpackPath);
    if (path.basename(path.dirname(safeModpackPath)) !== 'modpacks') {
      throw new Error('Modpack path must point to a FriendLauncher modpack directory');
    }
    modpackId = modpackId || path.basename(safeModpackPath);
    const expectedPath = resolveApprovedInstancePath(modpacks.getModpackDir(rootPath, modpackId));
    if (safeModpackPath !== expectedPath) {
      throw new Error('Modpack path does not match the selected launcher root and modpack id');
    }
    modpackPath = safeModpackPath;
  } else {
    const selected = modpackId || modpacks.getSelectedModpackId(rootPath);
    modpackId = selected;
    // Persist selection when the caller explicitly passes modpackId. Skip for classic — hidden instance, not in index.
    if (options.modpackId && modpackId !== CLASSIC_MODPACK_ID) {
      try {
        modpacks.setSelectedModpack(rootPath, selected);
      } catch {
        /* ignore */
      }
    }
    modpackPath = modpacks.getModpackDir(rootPath, selected);
  }

  fs.mkdirSync(modpackPath, { recursive: true });
  fs.mkdirSync(path.join(modpackPath, 'mods'), { recursive: true });

  return { rootPath, modpackId, modpackPath };
}

// Legacy alias for backward compatibility
export const resolveRootAndInstance = resolveRootAndModpack;
