import fs from 'node:fs';
import path from 'node:path';
import type { DownloadProvider } from '../mirrors/providers';
import type { LibraryEntry } from './types';

function normalizeForgeMavenUrl(value: string): string {
  // Some Forge profiles still reference the legacy host via HTTP.
  // Normalize to the canonical HTTPS maven host to avoid slow/blocked endpoints and mixed content.
  const legacyHttp = 'http://files.minecraftforge.net/maven';
  const legacyHttps = 'https://files.minecraftforge.net/maven';
  const canonical = 'https://maven.minecraftforge.net';
  if (value.startsWith(legacyHttp)) return `${canonical}${value.substring(legacyHttp.length)}`;
  if (value.startsWith(legacyHttps)) return `${canonical}${value.substring(legacyHttps.length)}`;
  return value;
}

export function patchLibraryUrls(libraries: LibraryEntry[], provider: DownloadProvider) {
  let changed = false;
  const patchValue = (value: unknown) => {
    if (typeof value !== 'string' || !value) return value;
    const normalized = normalizeForgeMavenUrl(value);
    const injected = provider.injectURL(normalized);
    if (injected !== value) {
      changed = true;
      return injected;
    }
    return value;
  };
  for (const lib of libraries) {
    if (lib?.url) lib.url = patchValue(lib.url) as string | undefined;
    const artifact = lib?.downloads?.artifact;
    if (artifact?.url) artifact.url = patchValue(artifact.url) as string | undefined;
    const classifiers = lib?.downloads?.classifiers;
    if (classifiers && typeof classifiers === 'object') {
      for (const key of Object.keys(classifiers)) {
        const entry = classifiers[key];
        if (entry?.url) entry.url = patchValue(entry.url) as string | undefined;
      }
    }
  }
  return changed;
}

export function rewriteForgeInstallProfile(
  rootPath: string,
  versionId: string,
  provider: DownloadProvider,
  onLog: (data: string) => void
) {
  const profilePath = path.join(rootPath, 'versions', versionId, 'install_profile.json');
  if (!fs.existsSync(profilePath)) return false;
  try {
    const raw = fs.readFileSync(profilePath, 'utf-8');
    const data = JSON.parse(raw);
    const libs = data?.libraries;
    if (!Array.isArray(libs)) return false;
    const changed = patchLibraryUrls(libs, provider);
    if (changed) {
      fs.writeFileSync(profilePath, JSON.stringify(data, null, 2));
      onLog('[Forge] Patched install_profile.json with mirrors.');
    }
    return changed;
  } catch {
    return false;
  }
}

export function rewriteForgeVersionJson(
  rootPath: string,
  versionId: string,
  provider: DownloadProvider,
  onLog: (data: string) => void
) {
  const versionPath = path.join(rootPath, 'versions', versionId, `${versionId}.json`);
  if (!fs.existsSync(versionPath)) return false;
  try {
    const raw = fs.readFileSync(versionPath, 'utf-8');
    const data = JSON.parse(raw);
    const libs = data?.libraries;
    if (!Array.isArray(libs)) return false;
    const changed = patchLibraryUrls(libs, provider);
    if (changed) {
      fs.writeFileSync(versionPath, JSON.stringify(data, null, 2));
      onLog('[Forge] Patched version json with mirrors.');
    }
    return changed;
  } catch {
    return false;
  }
}

/**
 * Forge 1.6.x (and some other legacy installers) can generate a version JSON without `inheritsFrom`.
 * `@xmcl/core` uses `inheritsFrom` to resolve the base Minecraft jar on the classpath.
 * Without it, Forge launches with missing `versions/<mcVersion>/<mcVersion>.jar` and crashes in class patching.
 */
export function ensureVersionInheritsFromBase(
  rootPath: string,
  versionId: string,
  mcVersion: string,
  onLog: (data: string) => void
) {
  const versionPath = path.join(rootPath, 'versions', versionId, `${versionId}.json`);
  if (!fs.existsSync(versionPath)) return false;
  try {
    const raw = fs.readFileSync(versionPath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const current = typeof data.inheritsFrom === 'string' ? (data.inheritsFrom as string) : '';
    if (current && current === mcVersion) return false;
    if (!current) {
      data.inheritsFrom = mcVersion;
      // Legacy launchers also sometimes use `jar` as a hint; harmless if ignored.
      if (typeof data.jar !== 'string' || !(data.jar as string)) {
        data.jar = mcVersion;
      }
      fs.writeFileSync(versionPath, JSON.stringify(data, null, 2));
      onLog(`[Forge] Patched version json: inheritsFrom=${mcVersion}`);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

