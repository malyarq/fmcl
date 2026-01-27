import fs from 'fs';
import path from 'path';
import type { ModpackConfig, ModpackService } from '../../modpacks/modpackService';

export function loadModpackConfig(params: {
  modpacks: ModpackService;
  rootPath: string;
  modpackId: string;
  modpackPath: string;
}): ModpackConfig | undefined {
  const { modpacks, rootPath, modpackId, modpackPath } = params;

  // Source of truth: if we have a modpack config, prefer it over renderer-provided options.
  let modpackCfg: ModpackConfig | undefined;
  try {
    if (modpackId) {
      modpackCfg = modpacks.loadModpackConfig(rootPath, modpackId);
    } else if (modpackPath) {
      const cfgPath = path.join(modpackPath, 'modpack.json');
      if (fs.existsSync(cfgPath)) {
        modpackCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as ModpackConfig;
      }
    }
  } catch {
    // ignore, fall back to passed options
  }

  return modpackCfg;
}

// Legacy alias for backward compatibility
export const loadInstanceConfig = loadModpackConfig;

