import { AtomicJsonStore } from '../../services/storage/atomicJsonStore';
import {
  assertAbsolutePath,
  resolvePathWithinRoot,
} from '../../security/pathGuards';
import type {
  CanonicalInstanceSnapshot,
  InstanceControlPlaneRead,
  InstanceEditableConfig,
  InstanceLoader,
  LauncherRoot,
} from '../../domains/instances/instanceTypes';
import type { InstanceControlPlanePort } from '../../domains/instances/ports';

const CANONICAL_FILE = 'instance-control-plane.json';

type ObjectRecord = Record<string, unknown>;

type ControlPlaneDocument = Readonly<{
  snapshot: CanonicalInstanceSnapshot;
}>;

export type ControlPlanePreparationResult =
  | Readonly<{ status: 'uninitialized' }>
  | Readonly<{
    status: 'ready';
    source: 'canonical';
    snapshot: CanonicalInstanceSnapshot;
  }>
  | Readonly<{ status: 'recovery-required'; reason: string }>;

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
    if (!isObjectRecord(value) || Object.keys(value).length !== 1 || !('snapshot' in value)) return false;
    assertCanonicalSnapshot(value.snapshot);
    return true;
  } catch {
    return false;
  }
}

/** Filesystem adapter for the sole canonical instance control-plane document. */
export class JsonControlPlaneStore implements InstanceControlPlanePort {
  public constructor(private readonly rootPathFor: (root: LauncherRoot) => string) {}

  public async read(root: LauncherRoot): Promise<InstanceControlPlaneRead> {
    const document = this.readDocument(root);
    return document ? { status: 'ready', snapshot: clone(document.snapshot) } : { status: 'uninitialized' };
  }

  public async commit(root: LauncherRoot, snapshot: CanonicalInstanceSnapshot): Promise<void> {
    assertCanonicalSnapshot(snapshot);
    this.storeFor(root).write({ snapshot: clone(snapshot) });
  }

  public async prepare(root: LauncherRoot): Promise<ControlPlanePreparationResult> {
    try {
      const document = this.readDocument(root);
      return document
        ? { status: 'ready', source: 'canonical', snapshot: clone(document.snapshot) }
        : { status: 'uninitialized' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'recovery-required', reason: `Canonical control-plane is unavailable: ${message}` };
    }
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
}
