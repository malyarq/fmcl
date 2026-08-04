import type {
  CanonicalInstanceRecord,
  CanonicalInstanceSnapshot,
  InstanceCommand,
  InstanceCommandResult,
  InstanceControlPlaneRead,
  InstanceEditableConfig,
  InstanceSourceMetadata,
  InstanceSummary,
  LauncherRoot,
} from './instanceTypes';
import type { InstanceApplicationPorts } from './ports';

type ObjectRecord = Record<string, unknown>;

function isObjectRecord(value: unknown): value is ObjectRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertInstanceConfig(value: unknown): asserts value is InstanceEditableConfig {
  if (!isObjectRecord(value) || !isObjectRecord(value.runtime)) {
    throw new Error('Instance config must include a runtime');
  }

  assertNonEmptyString(value.runtime.minecraftVersion, 'Instance config runtime minecraftVersion');
  if (value.runtime.modLoader !== undefined) {
    if (!isObjectRecord(value.runtime.modLoader)) {
      throw new Error('Instance config mod loader must be an object');
    }
    const loaderType = value.runtime.modLoader.type;
    if (typeof loaderType !== 'string' || !['vanilla', 'forge', 'fabric', 'quilt', 'neoforge'].includes(loaderType)) {
      throw new Error('Instance config mod loader is unsupported');
    }
    if (value.runtime.modLoader.version !== undefined) {
      assertNonEmptyString(value.runtime.modLoader.version, 'Instance config mod loader version');
    }
  }
}

function assertSourceMetadata(value: unknown, timestampsRequired: boolean): asserts value is InstanceSourceMetadata {
  if (!isObjectRecord(value)) {
    throw new Error('Instance source metadata must be an object');
  }
  if (typeof value.source !== 'string' || !['local', 'curseforge', 'modrinth'].includes(value.source)) {
    throw new Error('Instance source metadata has an unsupported source');
  }
  for (const field of ['sourceId', 'sourceVersionId', 'version', 'iconUrl', 'description', 'author'] as const) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      throw new Error(`Instance source metadata ${field} must be a string`);
    }
  }
  if (timestampsRequired) {
    assertNonEmptyString(value.createdAt, 'Instance source metadata createdAt');
    assertNonEmptyString(value.updatedAt, 'Instance source metadata updatedAt');
  }
}

function equalLoader(
  left: InstanceEditableConfig['runtime']['modLoader'],
  right: InstanceSummary['modLoader'],
): boolean {
  return left?.type === right?.type && left?.version === right?.version;
}

function assertCanonicalRecord(value: unknown): asserts value is CanonicalInstanceRecord {
  if (!isObjectRecord(value)) {
    throw new Error('Canonical instance record must be an object');
  }
  assertNonEmptyString(value.id, 'Canonical instance id');
  assertNonEmptyString(value.name, 'Canonical instance name');
  assertSourceMetadata(value.source, true);
  assertInstanceConfig(value.config);
  if (!isObjectRecord(value.summary)) {
    throw new Error('Canonical instance summary must be an object');
  }
  assertNonEmptyString(value.summary.minecraftVersion, 'Canonical instance summary minecraftVersion');
  if (value.summary.modLoader !== undefined && !isObjectRecord(value.summary.modLoader)) {
    throw new Error('Canonical instance summary mod loader must be an object');
  }

  const summary = value.summary as InstanceSummary;
  if (summary.minecraftVersion !== value.config.runtime.minecraftVersion || !equalLoader(value.config.runtime.modLoader, summary.modLoader)) {
    throw new Error('Canonical instance summary must agree with editable config');
  }
}

function assertSnapshot(snapshot: CanonicalInstanceSnapshot): void {
  if (!Array.isArray(snapshot.records)) {
    throw new Error('Canonical instance snapshot records must be an array');
  }

  const ids = new Set<string>();
  for (const record of snapshot.records) {
    assertCanonicalRecord(record);
    if (ids.has(record.id)) {
      throw new Error(`Canonical instance snapshot has duplicate instance id: ${record.id}`);
    }
    ids.add(record.id);
  }

  if (snapshot.records.length === 0 && snapshot.selectedId !== null) {
    throw new Error('Canonical instance snapshot selected id must be null when empty');
  }
  if (snapshot.records.length > 0 && (snapshot.selectedId === null || !ids.has(snapshot.selectedId))) {
    throw new Error('Canonical instance snapshot selected id must reference a record');
  }
}

function cloneConfig(config: InstanceEditableConfig): InstanceEditableConfig {
  return {
    ...config,
    runtime: {
      ...config.runtime,
      ...(config.runtime.modLoader ? { modLoader: { ...config.runtime.modLoader } } : {}),
    },
    ...(config.java ? { java: { ...config.java } } : {}),
    ...(config.memory ? { memory: { ...config.memory } } : {}),
    ...(config.vmOptions ? { vmOptions: [...config.vmOptions] } : {}),
    ...(config.game
      ? {
        game: {
          ...config.game,
          ...(config.game.resolution ? { resolution: { ...config.game.resolution } } : {}),
          ...(config.game.extraArgs ? { extraArgs: [...config.game.extraArgs] } : {}),
        },
      }
      : {}),
    ...(config.server ? { server: { ...config.server } } : {}),
  };
}

function summaryFromConfig(config: InstanceEditableConfig): InstanceSummary {
  return {
    minecraftVersion: config.runtime.minecraftVersion,
    ...(config.runtime.modLoader ? { modLoader: { ...config.runtime.modLoader } } : {}),
  };
}

function cloneRecord(record: CanonicalInstanceRecord): CanonicalInstanceRecord {
  return {
    ...record,
    source: { ...record.source },
    config: cloneConfig(record.config),
    summary: {
      ...record.summary,
      ...(record.summary.modLoader ? { modLoader: { ...record.summary.modLoader } } : {}),
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}

function freezeSnapshot(snapshot: CanonicalInstanceSnapshot): CanonicalInstanceSnapshot {
  return deepFreeze({
    selectedId: snapshot.selectedId,
    records: snapshot.records.map(cloneRecord),
  });
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== typeof right || left === null || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => sameValue(item, right[index]));
  }
  if (!isObjectRecord(left) || !isObjectRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && sameValue(left[key], right[key]));
}

function assertSupportedCommand(value: unknown): asserts value is InstanceCommand {
  if (!isObjectRecord(value) || value.version !== 1 || typeof value.type !== 'string') {
    throw new Error('Unsupported instance command version');
  }

  switch (value.type) {
    case 'create':
      assertNonEmptyString(value.name, 'Create command name');
      assertSourceMetadata(value.source, false);
      assertInstanceConfig(value.config);
      return;
    case 'rename':
      assertNonEmptyString(value.id, 'Rename command id');
      assertNonEmptyString(value.name, 'Rename command name');
      return;
    case 'select':
    case 'delete':
      assertNonEmptyString(value.id, `${value.type} command id`);
      return;
    case 'save-config':
      assertNonEmptyString(value.id, 'Save config command id');
      assertInstanceConfig(value.config);
      return;
    case 'update-metadata':
      assertNonEmptyString(value.id, 'Update metadata command id');
      if (value.description !== undefined && (typeof value.description !== 'string' || !value.description.trim() || value.description.length > 4_000)) {
        throw new Error('Update metadata command description must be a non-empty string up to 4000 characters');
      }
      return;
    case 'commit-published':
    case 'reconcile-update':
      assertCanonicalRecord(value.record);
      if (value.type === 'commit-published' && value.select !== undefined && typeof value.select !== 'boolean') {
        throw new Error('Published command select must be a boolean');
      }
      return;
    default:
      throw new Error(`Unsupported instance command type: ${value.type}`);
  }
}

/**
 * Canonical instance application boundary. Its collaborators are deliberately
 * capability-shaped, so this module remains independent from Electron, Node,
 * filesystem, provider, archive, and process implementations.
 */
export class InstanceApplication {
  public constructor(private readonly ports: InstanceApplicationPorts) {}

  public async read(root: LauncherRoot): Promise<InstanceControlPlaneRead> {
    return await this.ports.controlPlane.read(root);
  }

  public async execute(root: LauncherRoot, command: unknown): Promise<InstanceCommandResult> {
    assertSupportedCommand(command);
    const current = await this.read(root);
    const snapshot = current.status === 'uninitialized'
      ? { selectedId: null, records: [] as CanonicalInstanceRecord[] }
      : current.snapshot;

    assertSnapshot(snapshot);
    const result = this.apply(snapshot, command);
    const immutableSnapshot = freezeSnapshot(result.snapshot);

    if (result.status === 'committed') {
      await this.ports.controlPlane.commit(root, immutableSnapshot);
    }

    return deepFreeze({ status: result.status, snapshot: immutableSnapshot });
  }

  private apply(snapshot: CanonicalInstanceSnapshot, command: InstanceCommand): InstanceCommandResult {
    const recordForId = (id: string): CanonicalInstanceRecord => {
      const record = snapshot.records.find((candidate) => candidate.id === id);
      if (!record) throw new Error(`Canonical instance does not exist: ${id}`);
      return record;
    };
    const result = (status: InstanceCommandResult['status'], nextSnapshot: CanonicalInstanceSnapshot): InstanceCommandResult => {
      assertSnapshot(nextSnapshot);
      return { status, snapshot: nextSnapshot };
    };

    switch (command.type) {
      case 'create': {
        const id = this.ports.ids.next();
        assertNonEmptyString(id, 'Generated instance id');
        if (snapshot.records.some((record) => record.id === id)) {
          throw new Error(`Canonical instance snapshot has duplicate instance id: ${id}`);
        }
        const now = this.ports.clock.now();
        assertNonEmptyString(now, 'Clock value');
        const record: CanonicalInstanceRecord = {
          id,
          name: command.name.trim(),
          source: { ...command.source, createdAt: now, updatedAt: now },
          config: cloneConfig(command.config),
          summary: summaryFromConfig(command.config),
        };
        return result('committed', {
          selectedId: snapshot.selectedId ?? record.id,
          records: [...snapshot.records, record],
        });
      }
      case 'rename': {
        const record = recordForId(command.id);
        const name = command.name.trim();
        if (record.name === name) return result('noop', snapshot);
        const updated: CanonicalInstanceRecord = {
          ...cloneRecord(record),
          name,
          source: { ...record.source, updatedAt: this.ports.clock.now() },
        };
        return result('committed', {
          selectedId: snapshot.selectedId,
          records: snapshot.records.map((candidate) => candidate.id === record.id ? updated : candidate),
        });
      }
      case 'select':
        recordForId(command.id);
        return snapshot.selectedId === command.id
          ? result('noop', snapshot)
          : result('committed', { selectedId: command.id, records: snapshot.records });
      case 'save-config': {
        const record = recordForId(command.id);
        const config = cloneConfig(command.config);
        if (sameValue(record.config, config)) return result('noop', snapshot);
        const updated: CanonicalInstanceRecord = {
          ...cloneRecord(record),
          config,
          summary: summaryFromConfig(config),
          source: { ...record.source, updatedAt: this.ports.clock.now() },
        };
        return result('committed', {
          selectedId: snapshot.selectedId,
          records: snapshot.records.map((candidate) => candidate.id === record.id ? updated : candidate),
        });
      }
      case 'update-metadata': {
        const record = recordForId(command.id);
        if (record.source.description === command.description) return result('noop', snapshot);
        const updated: CanonicalInstanceRecord = {
          ...cloneRecord(record),
          source: { ...record.source, description: command.description, updatedAt: this.ports.clock.now() },
        };
        return result('committed', {
          selectedId: snapshot.selectedId,
          records: snapshot.records.map((candidate) => candidate.id === record.id ? updated : candidate),
        });
      }
      case 'commit-published': {
        const existing = snapshot.records.find((record) => record.id === command.record.id);
        if (existing) {
          if (sameValue(existing, command.record)) return result('noop', snapshot);
          throw new Error(`Published canonical instance conflicts with existing id: ${command.record.id}`);
        }
        return result('committed', {
          selectedId: command.select === true || snapshot.selectedId === null ? command.record.id : snapshot.selectedId,
          records: [...snapshot.records, cloneRecord(command.record)],
        });
      }
      case 'reconcile-update': {
        const existing = recordForId(command.record.id);
        if (sameValue(existing, command.record)) return result('noop', snapshot);
        return result('committed', {
          selectedId: snapshot.selectedId,
          records: snapshot.records.map((record) => record.id === command.record.id ? cloneRecord(command.record) : record),
        });
      }
      case 'delete': {
        const existing = snapshot.records.find((record) => record.id === command.id);
        if (!existing) return result('noop', snapshot);
        const records = snapshot.records.filter((record) => record.id !== command.id);
        return result('committed', {
          selectedId: snapshot.selectedId === command.id ? (records[0]?.id ?? null) : snapshot.selectedId,
          records,
        });
      }
    }
  }
}
