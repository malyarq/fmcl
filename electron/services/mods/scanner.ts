import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  readFabricMod,
  readForgeMod,
  readForgeModJson,
  readForgeModManifest,
  readForgeModToml,
  readQuiltMod,
} from '@xmcl/mod-parser';

import type { ModDependency, ModEntry, ModLoaderType } from './types';

function sha1OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function normalizeName(id: string, name?: string) {
  const cleaned = (name ?? '').trim();
  return cleaned.length > 0 ? cleaned : id;
}

function normalizeVersion(v?: string) {
  const cleaned = (v ?? '').trim();
  return cleaned.length > 0 ? cleaned : 'unknown';
}

function pushDeps(out: ModDependency[], kind: ModDependency['kind'], record?: Record<string, string | string[]>) {
  if (!record) return;
  for (const [id, versionRange] of Object.entries(record)) {
    out.push({ id, versionRange, kind });
  }
}

async function tryParseFabric(filePath: string): Promise<ModEntry[] | null> {
  try {
    const meta = await readFabricMod(filePath);
    const deps: ModDependency[] = [];
    pushDeps(deps, 'depends', meta.depends);
    pushDeps(deps, 'recommends', meta.recommends);
    pushDeps(deps, 'suggests', meta.suggests);
    pushDeps(deps, 'breaks', meta.breaks);
    pushDeps(deps, 'conflicts', meta.conflicts);

    return [
      {
        id: meta.id,
        name: normalizeName(meta.id, meta.name),
        version: normalizeVersion(meta.version),
        loaders: ['fabric'],
        deps,
        file: await statFile(filePath),
        hash: { sha1: await sha1OfFile(filePath) },
      },
    ];
  } catch {
    return null;
  }
}

async function tryParseQuilt(filePath: string): Promise<ModEntry[] | null> {
  try {
    const meta = await readQuiltMod(filePath);
    const id = meta.quilt_loader?.id;
    if (!id) return null;

    const deps: ModDependency[] = [];
    // Quilt dependencies are arrays of objects; we normalize only ids + versions.
    for (const dep of meta.quilt_loader?.depends ?? []) {
      deps.push({ id: dep.id, versionRange: dep.versions, optional: dep.optional, kind: 'depends' });
    }
    for (const dep of meta.quilt_loader?.breaks ?? []) {
      deps.push({ id: dep.id, versionRange: dep.versions, optional: dep.optional, kind: 'breaks' });
    }

    return [
      {
        id,
        name: normalizeName(id, meta.quilt_loader?.metadata?.name),
        version: normalizeVersion(meta.quilt_loader?.version),
        loaders: ['quilt'],
        deps,
        file: await statFile(filePath),
        hash: { sha1: await sha1OfFile(filePath) },
      },
    ];
  } catch {
    return null;
  }
}

async function parseForgeFast(filePath: string): Promise<ModEntry[] | null> {
  const manifestStore: Record<string, string> = {};
  try {
    const [mcmodInfo, manifestMetadata, modsToml] = await Promise.all([
      readForgeModJson(filePath).catch(() => []),
      readForgeModManifest(filePath, manifestStore).catch(() => undefined),
      readForgeModToml(filePath, manifestStore).catch(() => []),
    ]);

    const entries: ModEntry[] = [];
    const fileStat = await statFile(filePath);
    const sha1 = await sha1OfFile(filePath);

    if (modsToml.length > 0) {
      for (const m of modsToml) {
        entries.push({
          id: m.modid,
          name: normalizeName(m.modid, m.displayName),
          version: normalizeVersion(m.version),
          loaders: ['forge'],
          deps: (m.dependencies ?? []).map((d) => ({
            id: d.modId,
            versionRange: d.versionRange,
            optional: !d.mandatory,
            kind: 'depends',
          })),
          file: fileStat,
          hash: { sha1 },
        });
      }
      return entries;
    }

    if (mcmodInfo.length > 0) {
      for (const m of mcmodInfo) {
        entries.push({
          id: m.modid,
          name: normalizeName(m.modid, m.name),
          version: normalizeVersion(m.version),
          loaders: ['forge'],
          deps: [],
          file: fileStat,
          hash: { sha1 },
        });
      }
      return entries;
    }

    if (manifestMetadata?.modid) {
      return [
        {
          id: manifestMetadata.modid,
          name: normalizeName(manifestMetadata.modid, manifestMetadata.name),
          version: normalizeVersion(manifestMetadata.version),
          loaders: ['forge'],
          deps: [],
          file: fileStat,
          hash: { sha1 },
        },
      ];
    }

    return null;
  } catch {
    return null;
  }
}

async function parseForgeFull(filePath: string): Promise<ModEntry[] | null> {
  try {
    const meta = await readForgeMod(filePath);
    const fileStat = await statFile(filePath);
    const sha1 = await sha1OfFile(filePath);

    const candidates: Array<{ id: string; name?: string; version?: string; deps?: string }> = [];

    for (const t of meta.modsToml ?? []) {
      candidates.push({ id: t.modid, name: t.displayName, version: t.version });
    }
    for (const j of meta.mcmodInfo ?? []) {
      candidates.push({ id: j.modid, name: j.name, version: j.version });
    }
    for (const a of meta.modAnnotations ?? []) {
      if (a.modid) candidates.push({ id: a.modid, name: a.name, version: a.version, deps: a.dependencies });
    }
    if (meta.manifestMetadata?.modid) {
      candidates.push({
        id: meta.manifestMetadata.modid,
        name: meta.manifestMetadata.name,
        version: meta.manifestMetadata.version,
      });
    }

    const unique = new Map<string, ModEntry>();
    for (const c of candidates) {
      const id = c.id;
      if (!id) continue;
      if (!unique.has(id)) {
        unique.set(id, {
          id,
          name: normalizeName(id, c.name),
          version: normalizeVersion(c.version),
          loaders: ['forge'],
          deps: c.deps ? [{ id: '(forge-deps)', versionRange: c.deps, kind: 'depends' }] : [],
          file: fileStat,
          hash: { sha1 },
        });
      }
    }

    const out = Array.from(unique.values());
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

async function statFile(filePath: string) {
  const s = await fs.promises.stat(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    size: s.size,
    mtimeMs: s.mtimeMs,
  };
}

export async function parseModJar(filePath: string): Promise<ModEntry[]> {
  // Ordering: Fabric/Quilt are cheap (single json read). Forge can be expensive (ASM),
  // so try "fast" metadata first and only then full scan.
  const fabric = await tryParseFabric(filePath);
  if (fabric) return fabric;
  const quilt = await tryParseQuilt(filePath);
  if (quilt) return quilt;

  const forgeFast = await parseForgeFast(filePath);
  if (forgeFast) return forgeFast;

  const forgeFull = await parseForgeFull(filePath);
  if (forgeFull) return forgeFull;

  // Unknown jar: still return a stable file entry for logging.
  const st = await statFile(filePath);
  const sha1 = await sha1OfFile(filePath);
  const id = st.name;
  return [
    {
      id,
      name: id,
      version: 'unknown',
      loaders: ['unknown' as ModLoaderType],
      deps: [],
      file: st,
      hash: { sha1 },
    },
  ];
}

export async function scanModsFolder(modsDir: string): Promise<ModEntry[]> {
  if (!fs.existsSync(modsDir)) return [];
  const files = await fs.promises.readdir(modsDir);
  const jars = files
    .filter((f) => f.endsWith('.jar') && !f.startsWith('.'))
    .map((f) => path.join(modsDir, f));

  const results: ModEntry[] = [];
  for (const jar of jars) {
    try {
      const parsed = await parseModJar(jar);
      results.push(...parsed);
    } catch {
      // Ignore unreadable jar; keep scanner robust.
      const st = await statFile(jar).catch(() => null);
      if (st) {
        results.push({
          id: st.name,
          name: st.name,
          version: 'unknown',
          loaders: ['unknown'],
          deps: [],
          file: st,
          hash: { sha1: '' },
        });
      }
    }
  }
  return results;
}

