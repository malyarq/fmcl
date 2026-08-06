import fs from 'node:fs';
import { AtomicJsonStore } from '../../services/storage/atomicJsonStore';
import {
  assertAbsolutePath,
  assertChildName,
  resolvePathWithinRoot,
} from '../../security/pathGuards';
import type {
  CanonicalInstanceRecord,
  CanonicalInstanceSnapshot,
  InstanceControlPlaneRead,
  InstanceEditableConfig,
  InstanceLoader,
  InstanceSource,
  LauncherRoot,
} from '../../domains/instances/instanceTypes';
import type { InstanceControlPlanePort } from '../../domains/instances/ports';

const CANONICAL_FILE = 'instance-control-plane.json';
const LEGACY_VERSION = 1;

type ObjectRecord = Record<string, unknown>;

type MigrationProvenance = Readonly<{
  source: 'v0.7';
  version: 1;
}>;

type ControlPlaneDocument = Readonly<{
  snapshot: CanonicalInstanceSnapshot;
  migrationProvenance?: MigrationProvenance;
}>;

export type LegacyPreparationResult =
  | Readonly<{ status: 'uninitialized' }>
  | Readonly<{
    status: 'ready';
    source: 'canonical' | 'legacy-migration';
    snapshot: CanonicalInstanceSnapshot;
  }>
  | Readonly<{ status: 'recovery-required'; reason: string }>;

export type JsonControlPlaneStoreOptions = Readonly<{
  /** Test-only fault hook: publication has completed before this hook runs. */
  afterPublish?: () => unknown | Promise<unknown>;
}>;

type LegacyIndex = Readonly<{
  selectedId: string;
  names: ReadonlyMap<string, string>;
}>;

type LegacyMetadata = Readonly<{
  selectedId: string;
  records: ReadonlyMap<string, LegacyMetadataRecord>;
}>;

type LegacyMetadataRecord = Readonly<{
  id: string;
  name: string;
  source: InstanceSource;
  sourceId?: string;
  sourceVersionId?: string;
  version?: string;
  iconUrl?: string;
  description?: string;
  author?: string;
  minecraftVersion: string;
  modLoader?: Readonly<{ type: InstanceLoader; version?: string }>;
  createdAt: string;
  updatedAt: string;
}>;

function isObjectRecord(value: unknown): value is ObjectRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return stringValue(value, label);
}

function loader(value: unknown, label: string): Readonly<{ type: InstanceLoader; version?: string }> | undefined {
  if (value === undefined) return undefined;
  if (!isObjectRecord(value)) throw new Error(`${label} must be an object`);
  const type = stringValue(value.type, `${label}.type`);
  if (!['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].includes(type)) {
    throw new Error(`${label}.type is unsupported`);
  }
  const version = optionalString(value.version, `${label}.version`);
  return { type: type as InstanceLoader, ...(version ? { version } : {}) };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertSchemaVersion(value: ObjectRecord, label: string): void {
  if (value._fmclSchemaVersion !== LEGACY_VERSION) {
    throw new Error(`${label} has an unsupported legacy schema version`);
  }
}

function parseLegacyIndex(value: unknown): LegacyIndex {
  if (!isObjectRecord(value)) throw new Error('Legacy index must be an object');
  assertSchemaVersion(value, 'Legacy index');
  const selectedId = stringValue(value.selectedModpack, 'Legacy index selectedModpack');
  if (!isObjectRecord(value.modpacks)) throw new Error('Legacy index modpacks must be an object');
  const names = new Map<string, string>();
  for (const [id, entry] of Object.entries(value.modpacks)) {
    const safeId = assertChildName(id, 'Legacy index id');
    if (!isObjectRecord(entry)) throw new Error(`Legacy index record ${safeId} must be an object`);
    names.set(safeId, stringValue(entry.name, `Legacy index record ${safeId}.name`));
  }
  if (names.size === 0 || !names.has(selectedId)) throw new Error('Legacy index selection is dangling');
  return { selectedId, names };
}

function parseLegacyMetadataRecord(id: string, value: unknown): LegacyMetadataRecord {
  if (!isObjectRecord(value)) throw new Error(`Legacy metadata record ${id} must be an object`);
  const source = stringValue(value.source, `Legacy metadata record ${id}.source`);
  if (!['local', 'curseforge', 'modrinth'].includes(source)) {
    throw new Error(`Legacy metadata record ${id}.source is unsupported`);
  }
  const sourceId = optionalString(value.sourceId, `Legacy metadata record ${id}.sourceId`);
  const sourceVersionId = optionalString(value.sourceVersionId, `Legacy metadata record ${id}.sourceVersionId`);
  const version = optionalString(value.version, `Legacy metadata record ${id}.version`);
  const iconUrl = optionalString(value.iconUrl, `Legacy metadata record ${id}.iconUrl`);
  const description = optionalString(value.description, `Legacy metadata record ${id}.description`);
  const author = optionalString(value.author, `Legacy metadata record ${id}.author`);
  const modLoader = loader(value.modLoader, `Legacy metadata record ${id}.modLoader`);
  return {
    id: stringValue(value.id, `Legacy metadata record ${id}.id`),
    name: stringValue(value.name, `Legacy metadata record ${id}.name`),
    source: source as InstanceSource,
    ...(sourceId ? { sourceId } : {}),
    ...(sourceVersionId ? { sourceVersionId } : {}),
    ...(version ? { version } : {}),
    ...(iconUrl ? { iconUrl } : {}),
    ...(description ? { description } : {}),
    ...(author ? { author } : {}),
    minecraftVersion: stringValue(value.minecraftVersion, `Legacy metadata record ${id}.minecraftVersion`),
    ...(modLoader ? { modLoader } : {}),
    createdAt: stringValue(value.createdAt, `Legacy metadata record ${id}.createdAt`),
    updatedAt: stringValue(value.updatedAt, `Legacy metadata record ${id}.updatedAt`),
  };
}

function parseLegacyMetadata(value: unknown): LegacyMetadata {
  if (!isObjectRecord(value)) throw new Error('Legacy metadata must be an object');
  assertSchemaVersion(value, 'Legacy metadata');
  const selectedId = stringValue(value.selectedModpack, 'Legacy metadata selectedModpack');
  if (!isObjectRecord(value.modpacks)) throw new Error('Legacy metadata modpacks must be an object');
  const records = new Map<string, LegacyMetadataRecord>();
  const ids = new Set<string>();
  for (const [id, record] of Object.entries(value.modpacks)) {
    const safeId = assertChildName(id, 'Legacy metadata id');
    const parsed = parseLegacyMetadataRecord(safeId, record);
    if (parsed.id !== safeId || ids.has(parsed.id)) throw new Error('Legacy metadata contains ambiguous ids');
    ids.add(parsed.id);
    records.set(safeId, parsed);
  }
  if (records.size === 0 || !records.has(selectedId)) throw new Error('Legacy metadata selection is dangling');
  return { selectedId, records };
}

type MutableConfig = {
  runtime: InstanceEditableConfig['runtime'];
  java?: { executable?: string };
  memory?: { maxMb: number; minMb?: number };
  vmOptions?: string[];
  game?: { resolution?: { width?: number; height?: number; fullscreen?: boolean }; extraArgs?: string[]; useOptiFine?: boolean };
  server?: { host: string; port: number };
  networkMode?: InstanceEditableConfig['networkMode'];
};

function parseLegacyConfig(value: unknown, id: string, expectedName: string): InstanceEditableConfig {
  if (!isObjectRecord(value)) throw new Error(`Legacy config ${id} must be an object`);
  assertSchemaVersion(value, `Legacy config ${id}`);
  if (stringValue(value.id, `Legacy config ${id}.id`) !== id) throw new Error(`Legacy config ${id} id does not match`);
  if (stringValue(value.name, `Legacy config ${id}.name`) !== expectedName) throw new Error(`Legacy config ${id} name does not match`);
  if (!isObjectRecord(value.runtime)) throw new Error(`Legacy config ${id}.runtime must be an object`);
  const runtime = {
    minecraftVersion: stringValue(value.runtime.minecraft, `Legacy config ${id}.runtime.minecraft`),
    ...(loader(value.runtime.modLoader, `Legacy config ${id}.runtime.modLoader`) ? { modLoader: loader(value.runtime.modLoader, `Legacy config ${id}.runtime.modLoader`) } : {}),
  };
  const config: MutableConfig = { runtime };
  if (value.java !== undefined) {
    if (!isObjectRecord(value.java)) throw new Error(`Legacy config ${id}.java must be an object`);
    const executable = optionalString(value.java.path, `Legacy config ${id}.java.path`);
    config.java = executable ? { executable } : {};
  }
  if (value.memory !== undefined) {
    if (!isObjectRecord(value.memory) || typeof value.memory.maxMb !== 'number') throw new Error(`Legacy config ${id}.memory is invalid`);
    if (value.memory.minMb !== undefined && typeof value.memory.minMb !== 'number') throw new Error(`Legacy config ${id}.memory.minMb is invalid`);
    config.memory = { maxMb: value.memory.maxMb, ...(typeof value.memory.minMb === 'number' ? { minMb: value.memory.minMb } : {}) };
  }
  if (value.vmOptions !== undefined) {
    if (!Array.isArray(value.vmOptions) || value.vmOptions.some((entry) => typeof entry !== 'string')) throw new Error(`Legacy config ${id}.vmOptions is invalid`);
    config.vmOptions = [...value.vmOptions];
  }
  if (value.game !== undefined) {
    if (!isObjectRecord(value.game)) throw new Error(`Legacy config ${id}.game must be an object`);
    const game: NonNullable<MutableConfig['game']> = {};
    if (value.game.resolution !== undefined) {
      if (!isObjectRecord(value.game.resolution)) throw new Error(`Legacy config ${id}.game.resolution must be an object`);
      const { width, height, fullscreen } = value.game.resolution;
      if ((width !== undefined && typeof width !== 'number') || (height !== undefined && typeof height !== 'number') || (fullscreen !== undefined && typeof fullscreen !== 'boolean')) {
        throw new Error(`Legacy config ${id}.game.resolution is invalid`);
      }
      game.resolution = { ...(typeof width === 'number' ? { width } : {}), ...(typeof height === 'number' ? { height } : {}), ...(typeof fullscreen === 'boolean' ? { fullscreen } : {}) };
    }
    if (value.game.extraArgs !== undefined) {
      if (!Array.isArray(value.game.extraArgs) || value.game.extraArgs.some((entry) => typeof entry !== 'string')) throw new Error(`Legacy config ${id}.game.extraArgs is invalid`);
      game.extraArgs = [...value.game.extraArgs];
    }
    if (value.game.useOptiFine !== undefined) {
      if (typeof value.game.useOptiFine !== 'boolean') throw new Error(`Legacy config ${id}.game.useOptiFine is invalid`);
      game.useOptiFine = value.game.useOptiFine;
    }
    config.game = game;
  }
  if (value.server !== undefined) {
    if (!isObjectRecord(value.server) || typeof value.server.host !== 'string' || typeof value.server.port !== 'number') throw new Error(`Legacy config ${id}.server is invalid`);
    config.server = { host: value.server.host, port: value.server.port };
  }
  if (value.networkMode !== undefined) {
    if (!['hyperswarm', 'xmcl_lan', 'xmcl_upnp_host'].includes(String(value.networkMode))) throw new Error(`Legacy config ${id}.networkMode is invalid`);
    config.networkMode = value.networkMode as InstanceEditableConfig['networkMode'];
  }
  return config;
}

function configFromValidatedMetadata(metadata: LegacyMetadataRecord): InstanceEditableConfig {
  return {
    runtime: {
      minecraftVersion: metadata.minecraftVersion,
      ...(metadata.modLoader ? { modLoader: clone(metadata.modLoader) } : {}),
    },
  };
}

function assertCanonicalConfig(value: unknown): asserts value is InstanceEditableConfig {
  if (!isObjectRecord(value) || !isObjectRecord(value.runtime)) throw new Error('Canonical record config is invalid');
  stringValue(value.runtime.minecraftVersion, 'Canonical record config minecraftVersion');
  loader(value.runtime.modLoader, 'Canonical record config modLoader');
  if (value.java !== undefined) {
    if (!isObjectRecord(value.java)) throw new Error('Canonical record java is invalid');
    optionalString(value.java.executable, 'Canonical record java executable');
  }
  if (value.memory !== undefined) {
    if (!isObjectRecord(value.memory) || typeof value.memory.maxMb !== 'number' || (value.memory.minMb !== undefined && typeof value.memory.minMb !== 'number')) {
      throw new Error('Canonical record memory is invalid');
    }
  }
  if (value.vmOptions !== undefined && (!Array.isArray(value.vmOptions) || value.vmOptions.some((entry) => typeof entry !== 'string'))) {
    throw new Error('Canonical record vmOptions is invalid');
  }
  if (value.game !== undefined) {
    if (!isObjectRecord(value.game)) throw new Error('Canonical record game is invalid');
    if (value.game.resolution !== undefined) {
      if (!isObjectRecord(value.game.resolution)) throw new Error('Canonical record resolution is invalid');
      for (const field of ['width', 'height'] as const) {
        if (value.game.resolution[field] !== undefined && typeof value.game.resolution[field] !== 'number') throw new Error('Canonical record resolution is invalid');
      }
      if (value.game.resolution.fullscreen !== undefined && typeof value.game.resolution.fullscreen !== 'boolean') throw new Error('Canonical record resolution is invalid');
    }
    if (value.game.extraArgs !== undefined && (!Array.isArray(value.game.extraArgs) || value.game.extraArgs.some((entry) => typeof entry !== 'string'))) {
      throw new Error('Canonical record extraArgs is invalid');
    }
    if (value.game.useOptiFine !== undefined && typeof value.game.useOptiFine !== 'boolean') {
      throw new Error('Canonical record useOptiFine is invalid');
    }
  }
  if (value.server !== undefined && (!isObjectRecord(value.server) || typeof value.server.host !== 'string' || typeof value.server.port !== 'number')) {
    throw new Error('Canonical record server is invalid');
  }
  if (value.networkMode !== undefined && !['hyperswarm', 'xmcl_lan', 'xmcl_upnp_host'].includes(String(value.networkMode))) {
    throw new Error('Canonical record networkMode is invalid');
  }
}

function assertCanonicalSnapshot(value: unknown): asserts value is CanonicalInstanceSnapshot {
  if (!isObjectRecord(value) || !Array.isArray(value.records) || !('selectedId' in value)) {
    throw new Error('Canonical control-plane snapshot is invalid');
  }
  const ids = new Set<string>();
  for (const record of value.records) {
    if (!isObjectRecord(record) || !isObjectRecord(record.source) || !isObjectRecord(record.summary)) {
      throw new Error('Canonical control-plane record is invalid');
    }
    const id = stringValue(record.id, 'Canonical record id');
    stringValue(record.name, 'Canonical record name');
    if (ids.has(id)) throw new Error('Canonical control-plane contains duplicate ids');
    ids.add(id);
    const source = stringValue(record.source.source, 'Canonical record source');
    if (!['local', 'curseforge', 'modrinth'].includes(source)) throw new Error('Canonical record source is unsupported');
    for (const field of ['sourceId', 'sourceVersionId', 'version', 'iconUrl', 'description', 'author'] as const) {
      optionalString(record.source[field], `Canonical record ${field}`);
    }
    stringValue(record.source.createdAt, 'Canonical record createdAt');
    stringValue(record.source.updatedAt, 'Canonical record updatedAt');
    assertCanonicalConfig(record.config);
    const minecraftVersion = record.config.runtime.minecraftVersion;
    if (stringValue(record.summary.minecraftVersion, 'Canonical record summary minecraftVersion') !== minecraftVersion) {
      throw new Error('Canonical record summary does not match config');
    }
    const configLoader = loader(record.config.runtime.modLoader, 'Canonical record config modLoader');
    const summaryLoader = loader(record.summary.modLoader, 'Canonical record summary modLoader');
    if (configLoader?.type !== summaryLoader?.type || configLoader?.version !== summaryLoader?.version) {
      throw new Error('Canonical record summary does not match config');
    }
  }
  if (value.records.length === 0 && value.selectedId !== null) throw new Error('Canonical empty control plane has a selection');
  if (value.records.length > 0 && (typeof value.selectedId !== 'string' || !ids.has(value.selectedId))) {
    throw new Error('Canonical control-plane selection is dangling');
  }
}

function isControlPlaneDocument(value: unknown): value is ControlPlaneDocument {
  try {
    if (!isObjectRecord(value)) return false;
    assertCanonicalSnapshot(value.snapshot);
    if (value.migrationProvenance !== undefined) {
      if (!isObjectRecord(value.migrationProvenance) || value.migrationProvenance.source !== 'v0.7' || value.migrationProvenance.version !== LEGACY_VERSION) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Filesystem adapter for the sole canonical instance control-plane document.
 * It owns legacy parsing only; callers must acquire the root mutation lock
 * before calling prepareFromLegacy.
 */
export class JsonControlPlaneStore implements InstanceControlPlanePort {
  public constructor(
    private readonly rootPathFor: (root: LauncherRoot) => string,
    private readonly options: JsonControlPlaneStoreOptions = {},
  ) {}

  public async read(root: LauncherRoot): Promise<InstanceControlPlaneRead> {
    const document = this.readDocument(root);
    return document ? { status: 'ready', snapshot: clone(document.snapshot) } : { status: 'uninitialized' };
  }

  public async commit(root: LauncherRoot, snapshot: CanonicalInstanceSnapshot): Promise<void> {
    assertCanonicalSnapshot(snapshot);
    const existing = this.readDocument(root);
    this.storeFor(root).write({
      snapshot: clone(snapshot),
      ...(existing?.migrationProvenance ? { migrationProvenance: clone(existing.migrationProvenance) } : {}),
    });
  }

  public async prepareFromLegacy(root: LauncherRoot): Promise<LegacyPreparationResult> {
    let existing: ControlPlaneDocument | null;
    try {
      existing = this.readDocument(root);
    } catch (error) {
      return { status: 'recovery-required', reason: `Canonical control-plane is unavailable: ${this.message(error)}` };
    }
    if (existing) return { status: 'ready', source: 'canonical', snapshot: clone(existing.snapshot) };

    let snapshot: CanonicalInstanceSnapshot;
    try {
      const parsedSnapshot = this.parseLegacySnapshot(root);
      if (!parsedSnapshot) return { status: 'uninitialized' };
      snapshot = parsedSnapshot;
      this.storeFor(root).write({
        snapshot,
        migrationProvenance: { source: 'v0.7', version: LEGACY_VERSION },
      });
    } catch (error) {
      return { status: 'recovery-required', reason: `Legacy migration requires recovery: ${this.message(error)}` };
    }

    await this.options.afterPublish?.();
    return { status: 'ready', source: 'legacy-migration', snapshot: clone(snapshot) };
  }

  private readDocument(root: LauncherRoot): ControlPlaneDocument | null {
    return this.storeFor(root).read()?.value ?? null;
  }

  private storeFor(root: LauncherRoot): AtomicJsonStore<ControlPlaneDocument> {
    return new AtomicJsonStore(this.canonicalPath(root), { version: 1, validate: isControlPlaneDocument });
  }

  private canonicalPath(root: LauncherRoot): string {
    return resolvePathWithinRoot(this.rootPath(root), CANONICAL_FILE, 'Canonical control-plane path');
  }

  private rootPath(root: LauncherRoot): string {
    return assertAbsolutePath(this.rootPathFor(root), 'Launcher root path');
  }

  private parseLegacySnapshot(root: LauncherRoot): CanonicalInstanceSnapshot | null {
    const rootPath = this.rootPath(root);
    const indexPath = resolvePathWithinRoot(rootPath, 'modpacks.json', 'Legacy index path');
    const metadataPath = resolvePathWithinRoot(rootPath, 'modpacks-metadata.json', 'Legacy metadata path');
    const hasIndex = fs.existsSync(indexPath);
    const hasMetadata = fs.existsSync(metadataPath);
    if (!hasIndex && !hasMetadata) return null;
    if (!hasIndex || !hasMetadata) throw new Error('Legacy control-plane triplet is incomplete');

    const index = parseLegacyIndex(this.readLegacyJson(indexPath, 'Legacy index'));
    const metadata = parseLegacyMetadata(this.readLegacyJson(metadataPath, 'Legacy metadata'));
    if (index.selectedId !== metadata.selectedId || index.names.size !== metadata.records.size) {
      throw new Error('Legacy control-plane selection or record sets disagree');
    }

    const records: CanonicalInstanceRecord[] = [];
    for (const [id, name] of index.names) {
      const entry = metadata.records.get(id);
      if (!entry || entry.name !== name) throw new Error(`Legacy control-plane record ${id} disagrees`);
      const configPath = resolvePathWithinRoot(
        resolvePathWithinRoot(resolvePathWithinRoot(rootPath, 'modpacks', 'Legacy modpacks path'), assertChildName(id, 'Legacy config id'), 'Legacy modpack path'),
        'modpack.json',
        'Legacy config path',
      );
      const config = fs.existsSync(configPath)
        ? parseLegacyConfig(this.readLegacyJson(configPath, `Legacy config ${id}`), id, name)
        : configFromValidatedMetadata(entry);
      if (config.runtime.minecraftVersion !== entry.minecraftVersion || config.runtime.modLoader?.type !== entry.modLoader?.type || config.runtime.modLoader?.version !== entry.modLoader?.version) {
        throw new Error(`Legacy config ${id} runtime does not match metadata`);
      }
      records.push({
        id,
        name,
        source: {
          source: entry.source,
          ...(entry.sourceId ? { sourceId: entry.sourceId } : {}),
          ...(entry.sourceVersionId ? { sourceVersionId: entry.sourceVersionId } : {}),
          ...(entry.version ? { version: entry.version } : {}),
          ...(entry.iconUrl ? { iconUrl: entry.iconUrl } : {}),
          ...(entry.description ? { description: entry.description } : {}),
          ...(entry.author ? { author: entry.author } : {}),
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
        config,
        summary: {
          minecraftVersion: config.runtime.minecraftVersion,
          ...(config.runtime.modLoader ? { modLoader: clone(config.runtime.modLoader) } : {}),
        },
      });
    }
    const snapshot: CanonicalInstanceSnapshot = { selectedId: index.selectedId, records };
    assertCanonicalSnapshot(snapshot);
    return clone(snapshot);
  }

  private readLegacyJson(filePath: string, label: string): unknown {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`${label} is not readable JSON: ${this.message(error)}`);
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
