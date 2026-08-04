import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import {
  assertAbsolutePath,
  assertChildName,
  assertPathWithinRoot,
  resolvePathWithinRoot,
} from '../../security/pathGuards';

const XMCL_FOLDERS = ['assets', 'libraries', 'versions', 'modpacks'] as const;

function hasLauncherRootMarkers(rootPath: string): boolean {
  const safeRootPath = path.resolve(rootPath);
  const markers = [
    'modpacks.json',
    ...XMCL_FOLDERS,
  ];

  if (markers.some((entryName) => fs.existsSync(path.join(safeRootPath, entryName)))) {
    return true;
  }

  try {
    return safeRootPath === path.resolve(getDefaultRootPath());
  } catch {
    return false;
  }
}

export function getDefaultRootPath() {
  return path.join(app.getPath('userData'), 'minecraft_data');
}

export function resolveLauncherRootPath(rootPath?: string) {
  const candidatePath = rootPath?.trim() ? rootPath : getDefaultRootPath();
  return path.resolve(candidatePath);
}

export function resolveApprovedLauncherRootPath(rootPath?: string) {
  const safeRootPath = assertAbsolutePath(rootPath?.trim() || getDefaultRootPath(), 'Launcher root path');
  if (!hasLauncherRootMarkers(safeRootPath)) {
    throw new Error('Launcher root path must be the default path or a directory initialized by FriendLauncher');
  }
  return safeRootPath;
}

export function getModpackDir(rootPath: string, modpackId: string) {
  return resolvePathWithinRoot(
    resolvePathWithinRoot(resolveLauncherRootPath(rootPath), 'modpacks', 'Modpacks directory'),
    assertChildName(modpackId, 'Modpack id'),
    'Modpack directory',
  );
}

export function resolveApprovedInstancePath(instancePath: string) {
  const safeInstancePath = assertAbsolutePath(instancePath, 'Instance path');

  if (hasLauncherRootMarkers(safeInstancePath)) {
    return assertPathWithinRoot(safeInstancePath, safeInstancePath, 'Instance path');
  }

  const parentDir = path.dirname(safeInstancePath);
  if (path.basename(parentDir) !== 'modpacks') {
    throw new Error('Instance path must point to an approved launcher root or modpack directory');
  }

  const rootPath = path.dirname(parentDir);
  if (!hasLauncherRootMarkers(rootPath)) {
    throw new Error('Instance path must point to an approved launcher root or modpack directory');
  }

  return assertPathWithinRoot(
    resolvePathWithinRoot(rootPath, 'modpacks', 'Modpacks directory'),
    safeInstancePath,
    'Instance path',
  );
}

export function resolveWorldsDir(instancePath: string) {
  return resolvePathWithinRoot(resolveApprovedInstancePath(instancePath), 'saves', 'Worlds directory');
}

export function resolveWorldPath(instancePath: string, worldName: string) {
  return resolvePathWithinRoot(resolveWorldsDir(instancePath), assertChildName(worldName, 'World name'), 'World path');
}

export function resolveResourcePacksDir(instancePath: string) {
  return resolvePathWithinRoot(resolveApprovedInstancePath(instancePath), 'resourcepacks', 'Resource packs directory');
}

export function resolveShaderPacksDir(instancePath: string) {
  return resolvePathWithinRoot(resolveApprovedInstancePath(instancePath), 'shaderpacks', 'Shader packs directory');
}

export function resolveScreenshotsDir(instancePath: string) {
  return resolvePathWithinRoot(resolveApprovedInstancePath(instancePath), 'screenshots', 'Screenshots directory');
}
