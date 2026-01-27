import { logInstalledMods } from './logInstalledMods';

/**
 * Mods related helpers.
 *
 * Step-0 note: wrapper around legacy implementation.
 * Step 4 will replace this with @xmcl/mod-parser metadata scanning.
 */
export class ModsService {
  public async logInstalledMods(minecraftRootPath: string, onLog: (data: string) => void, gamePath?: string) {
    return logInstalledMods(minecraftRootPath, onLog, gamePath);
  }
}

