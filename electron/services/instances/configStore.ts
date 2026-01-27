import fs from 'node:fs';
import path from 'node:path';
import type { ModpackConfig } from './types';
import { getModpackConfigPath, getModpackDir } from './paths';

export function loadModpackConfigFile(rootPath: string, modpackId: string): ModpackConfig {
  const cfgPath = getModpackConfigPath(rootPath, modpackId);
  if (!fs.existsSync(cfgPath)) {
    // If index says modpack exists but file missing, reconstruct minimal config.
    const now = new Date().toISOString();
    const cfg: ModpackConfig = {
      id: modpackId,
      name: modpackId,
      runtime: { minecraft: '1.12.2', modLoader: { type: 'vanilla' } },
      memory: { maxMb: 4096 },
      vmOptions: [],
      createdAt: now,
      updatedAt: now,
    };
    fs.mkdirSync(getModpackDir(rootPath, modpackId), { recursive: true });
    fs.mkdirSync(path.join(getModpackDir(rootPath, modpackId), 'mods'), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8');
    return cfg;
  }
  return JSON.parse(fs.readFileSync(cfgPath, 'utf-8')) as ModpackConfig;
}

export function saveModpackConfigFile(rootPath: string, cfg: ModpackConfig) {
  const now = new Date().toISOString();
  const dir = getModpackDir(rootPath, cfg.id);
  fs.mkdirSync(dir, { recursive: true });
  cfg.updatedAt = now;
  if (!cfg.createdAt) cfg.createdAt = now;
  fs.writeFileSync(getModpackConfigPath(rootPath, cfg.id), JSON.stringify(cfg, null, 2), 'utf-8');
}

// Legacy aliases for backward compatibility
export const loadInstanceConfigFile = loadModpackConfigFile;
export const saveInstanceConfigFile = saveModpackConfigFile;

