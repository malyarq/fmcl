import fs from 'node:fs';
import path from 'node:path';
import type { ModLoaderType } from './types';

export function checkVersionFiles(
  rootPath: string,
  versionId: string,
  modLoader?: ModLoaderType
): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const versionDir = path.join(rootPath, 'versions', versionId);
  const versionJson = path.join(versionDir, `${versionId}.json`);
  const versionJar = path.join(versionDir, `${versionId}.jar`);

  if (!fs.existsSync(versionJson)) {
    missing.push('version.json');
    return { ok: false, missing };
  }

  // Check if version uses inheritsFrom (modloaders like Forge/NeoForge inherit from base)
  try {
    const versionData = JSON.parse(fs.readFileSync(versionJson, 'utf8'));
    const hasInheritsFrom = typeof versionData.inheritsFrom === 'string' && versionData.inheritsFrom.length > 0;
    
    // Fabric uses vanilla jar, so don't require version.jar for Fabric
    // Forge/NeoForge with inheritsFrom also use base jar, so version.jar may not exist
    if (modLoader === 'fabric' || hasInheritsFrom) {
      // These use base version jar, version.jar is optional
      return { ok: true, missing: [] };
    }
  } catch {
    // If we can't parse JSON, fall through to check version.jar
  }

  // For vanilla or modloaders without inheritsFrom, require version.jar
  if (!fs.existsSync(versionJar)) {
    missing.push('version.jar');
  }

  return { ok: missing.length === 0, missing };
}

export function checkLaunchReadiness(
  rootPath: string,
  versionId: string
): { ok: boolean; error?: string } {
  try {
    const versionDir = path.join(rootPath, 'versions', versionId);
    const versionJsonPath = path.join(versionDir, `${versionId}.json`);
    if (!fs.existsSync(versionJsonPath)) {
      return { ok: false, error: 'Version JSON not found' };
    }

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    const libraries = versionJson.libraries || [];
    const missingLibs: string[] = [];

    for (const lib of libraries) {
      if (!lib.downloads || !lib.downloads.artifact) continue;
      const libPath = lib.downloads.artifact.path || lib.name.replace(/:/g, '/');
      const fullPath = path.join(rootPath, 'libraries', libPath);
      if (!fs.existsSync(fullPath)) {
        missingLibs.push(libPath);
        if (missingLibs.length >= 5) break; // Limit to first 5
      }
    }

    if (missingLibs.length > 0) {
      return { ok: false, error: `Missing ${missingLibs.length} libraries (e.g., ${missingLibs[0]})` };
    }

    // Check main class exists
    if (!versionJson.mainClass) {
      return { ok: false, error: 'No mainClass in version.json' };
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Validation failed: ${msg}` };
  }
}
