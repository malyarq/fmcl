import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export function getDefaultRootPath() {
  return path.join(app.getPath('userData'), 'minecraft_data');
}

export function ensureXmclFolders(rootPath: string) {
  const base = rootPath?.trim() ? rootPath : getDefaultRootPath();
  fs.mkdirSync(base, { recursive: true });
  for (const folder of ['assets', 'libraries', 'versions', 'modpacks']) {
    try {
      fs.mkdirSync(path.join(base, folder), { recursive: true });
    } catch {
      // Folder already exists or creation failed, continue
    }
  }
}

export function getModpacksIndexPath(rootPath: string) {
  return path.join(rootPath, 'modpacks.json');
}

export function getModpackDir(rootPath: string, modpackId: string) {
  return path.join(rootPath, 'modpacks', modpackId);
}

export function getModpackConfigPath(rootPath: string, modpackId: string) {
  return path.join(getModpackDir(rootPath, modpackId), 'modpack.json');
}

// Legacy aliases for backward compatibility with file system
export const getInstancesIndexPath = getModpacksIndexPath;
export const getInstanceDir = getModpackDir;
export const getInstanceConfigPath = getModpackConfigPath;

