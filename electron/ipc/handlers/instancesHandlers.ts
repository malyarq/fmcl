import {
  INSTANCE_CHANNELS,
  type InstanceChannel,
  type InstanceConfigDto,
  type InstanceFailure,
  type InstanceListItemDto,
  type InstanceListResponse,
  type InstanceMetadataDto,
  type InstanceMutationResponse,
  type InstanceResult,
  type InstanceSnapshotDto,
  type InstanceSummaryDto,
} from '../../../shared/contracts/instances';
import type { InstanceApplication } from '../../domains/instances/instanceApplication';
import type {
  CanonicalInstanceRecord,
  CanonicalInstanceSnapshot,
  InstanceControlPlaneRead,
  InstanceEditableConfig,
  LauncherRoot,
} from '../../domains/instances/instanceTypes';
import {
  validateInstanceConfigRequest,
  validateInstanceCreateRequest,
  validateInstanceListRequest,
  validateInstanceMetadataRequest,
  validateInstancePrepareRequest,
  validateInstanceRenameRequest,
  validateInstanceSelectRequest,
  validateInstanceSnapshotRequest,
} from '../validation/privilegedPayloads';

type InstanceHandler = (request: unknown) => Promise<InstanceResult<unknown>>;

export type InstancesHandlers = Readonly<Record<InstanceChannel, InstanceHandler>>;

export type InstancesHandlerDependencies = Readonly<{
  application: InstanceApplication;
  /** Main owns this setting-backed authority; renderer input is never consulted. */
  getDefaultInstanceRoot(): Promise<LauncherRoot>;
}>;

function unavailable(): InstanceFailure {
  return { code: 'INSTANCE_UNAVAILABLE', message: 'Instance state is unavailable.' };
}

function uninitialized(): InstanceFailure {
  return { code: 'INSTANCE_UNINITIALIZED', message: 'Instance state is not prepared.' };
}

function missing(): InstanceFailure {
  return { code: 'INSTANCE_NOT_FOUND', message: 'Instance was not found.' };
}

function isPublicFailure(value: unknown): value is InstanceFailure {
  return typeof value === 'object'
    && value !== null
    && 'code' in value
    && 'message' in value
    && typeof value.code === 'string'
    && typeof value.message === 'string';
}

function publicText(value: string): string {
  if (value.includes('/') || value.includes('\\') || value.startsWith('~') || /^[a-z]:/i.test(value) || /^file:/i.test(value)) {
    throw unavailable();
  }

  return value;
}

function optionalPublicText(value: string | undefined): string | undefined {
  return value === undefined ? undefined : publicText(value);
}

function toSummary(record: CanonicalInstanceRecord): InstanceSummaryDto {
  return {
    minecraftVersion: publicText(record.summary.minecraftVersion),
    modLoader: record.summary.modLoader === undefined
      ? undefined
      : { type: record.summary.modLoader.type, version: optionalPublicText(record.summary.modLoader.version) },
  };
}

function toConfig(record: CanonicalInstanceRecord): InstanceConfigDto {
  const config = record.config;
  return {
    runtime: {
      minecraftVersion: publicText(config.runtime.minecraftVersion),
      modLoader: config.runtime.modLoader === undefined
        ? undefined
        : { type: config.runtime.modLoader.type, version: optionalPublicText(config.runtime.modLoader.version) },
    },
    memory: config.memory === undefined ? undefined : { ...config.memory },
    vmOptions: config.vmOptions === undefined ? undefined : config.vmOptions.map(publicText),
    game: config.game === undefined ? undefined : {
      resolution: config.game.resolution === undefined ? undefined : { ...config.game.resolution },
      extraArgs: config.game.extraArgs === undefined ? undefined : config.game.extraArgs.map(publicText),
      useOptiFine: config.game.useOptiFine,
    },
    server: config.server === undefined ? undefined : { host: publicText(config.server.host), port: config.server.port },
    networkMode: config.networkMode,
  };
}

function toMetadata(record: CanonicalInstanceRecord): InstanceMetadataDto {
  const source = record.source;
  const iconUrl = source.iconUrl;
  if (iconUrl !== undefined && !/^https?:\/\//i.test(iconUrl)) throw unavailable();
  return {
    source: source.source,
    sourceId: optionalPublicText(source.sourceId),
    sourceVersionId: optionalPublicText(source.sourceVersionId),
    version: optionalPublicText(source.version),
    iconUrl,
    description: optionalPublicText(source.description),
    author: optionalPublicText(source.author),
    createdAt: publicText(source.createdAt),
    updatedAt: publicText(source.updatedAt),
  };
}

function toSnapshot(record: CanonicalInstanceRecord): InstanceSnapshotDto {
  return {
    id: publicText(record.id),
    name: publicText(record.name),
    metadata: toMetadata(record),
    config: toConfig(record),
    summary: toSummary(record),
  };
}

function toListItem(record: CanonicalInstanceRecord, selectedId: string | null): InstanceListItemDto {
  return {
    id: publicText(record.id),
    name: publicText(record.name),
    selected: record.id === selectedId,
    summary: toSummary(record),
  };
}

function toList(read: InstanceControlPlaneRead): InstanceListResponse {
  if (read.status === 'uninitialized') return { status: 'uninitialized' };
  return { status: 'ready', instances: read.snapshot.records.map((record) => toListItem(record, read.snapshot.selectedId)) };
}

function toMutation(snapshot: CanonicalInstanceSnapshot, status: 'committed' | 'noop'): InstanceMutationResponse {
  return {
    status,
    selectedId: snapshot.selectedId === null ? null : publicText(snapshot.selectedId),
    instances: snapshot.records.map((record) => toListItem(record, snapshot.selectedId)),
  };
}

function findRecord(read: InstanceControlPlaneRead, id: string): CanonicalInstanceRecord | undefined {
  return read.status === 'ready' ? read.snapshot.records.find((record) => record.id === id) : undefined;
}

function toDomainConfig(config: InstanceConfigDto): InstanceEditableConfig {
  return {
    runtime: {
      minecraftVersion: config.runtime.minecraftVersion,
      modLoader: config.runtime.modLoader === undefined ? undefined : { ...config.runtime.modLoader },
    },
    memory: config.memory === undefined ? undefined : { ...config.memory },
    vmOptions: config.vmOptions === undefined ? undefined : [...config.vmOptions],
    game: config.game === undefined ? undefined : {
      resolution: config.game.resolution === undefined ? undefined : { ...config.game.resolution },
      extraArgs: config.game.extraArgs === undefined ? undefined : [...config.game.extraArgs],
      useOptiFine: config.game.useOptiFine,
    },
    server: config.server === undefined ? undefined : { ...config.server },
    networkMode: config.networkMode,
  };
}

async function safe<T>(operation: () => Promise<T>): Promise<InstanceResult<T>> {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return { ok: false, error: isPublicFailure(error) ? error : unavailable() };
  }
}

/**
 * Creates semantic handlers only. IPC registration and preload exposure are
 * deliberately deferred until the dedicated boundary-wiring plan.
 */
export function createInstancesHandlers(deps: InstancesHandlerDependencies): InstancesHandlers {
  const read = async (): Promise<InstanceControlPlaneRead> => await deps.application.read(await deps.getDefaultInstanceRoot());
  const execute = async (command: unknown) => await deps.application.execute(await deps.getDefaultInstanceRoot(), command);

  return {
    [INSTANCE_CHANNELS.list]: async (request) => {
      validateInstanceListRequest(request);
      return await safe(async () => toList(await read()));
    },
    [INSTANCE_CHANNELS.snapshot]: async (request) => {
      const parsed = validateInstanceSnapshotRequest(request);
      return await safe(async () => {
        const state = await read();
        if (state.status === 'uninitialized') throw uninitialized();
        const record = findRecord(state, parsed.id);
        if (!record) throw missing();
        return toSnapshot(record);
      });
    },
    [INSTANCE_CHANNELS.select]: async (request) => {
      const parsed = validateInstanceSelectRequest(request);
      return await safe(async () => {
        const result = await execute({ version: 1, type: 'select', id: parsed.id });
        return toMutation(result.snapshot, result.status);
      });
    },
    [INSTANCE_CHANNELS.create]: async (request) => {
      const parsed = validateInstanceCreateRequest(request);
      return await safe(async () => {
        const result = await execute({ version: 1, type: 'create', name: parsed.name, source: parsed.source, config: toDomainConfig(parsed.config) });
        return toMutation(result.snapshot, result.status);
      });
    },
    [INSTANCE_CHANNELS.rename]: async (request) => {
      const parsed = validateInstanceRenameRequest(request);
      return await safe(async () => {
        const result = await execute({ version: 1, type: 'rename', id: parsed.id, name: parsed.name });
        return toMutation(result.snapshot, result.status);
      });
    },
    [INSTANCE_CHANNELS.config]: async (request) => {
      const parsed = validateInstanceConfigRequest(request);
      if (parsed.action === 'get') {
        return await safe(async () => {
          const state = await read();
          if (state.status === 'uninitialized') throw uninitialized();
          const record = findRecord(state, parsed.id);
          if (!record) throw missing();
          return toConfig(record);
        });
      }
      return await safe(async () => {
        const result = await execute({ version: 1, type: 'save-config', id: parsed.id, config: toDomainConfig(parsed.config) });
        return toMutation(result.snapshot, result.status);
      });
    },
    [INSTANCE_CHANNELS.metadata]: async (request) => {
      const parsed = validateInstanceMetadataRequest(request);
      if ('action' in parsed) {
        return await safe(async () => {
          const result = await execute({
            version: 1,
            type: 'update-metadata',
            id: parsed.id,
            ...(parsed.metadata.description === null ? {} : { description: parsed.metadata.description }),
          });
          return toMutation(result.snapshot, result.status);
        });
      }
      return await safe(async () => {
        const state = await read();
        if (state.status === 'uninitialized') throw uninitialized();
        const record = findRecord(state, parsed.id);
        if (!record) throw missing();
        return toMetadata(record);
      });
    },
    [INSTANCE_CHANNELS.prepare]: async (request) => {
      validateInstancePrepareRequest(request);
      return await safe(async () => ({ status: (await read()).status }));
    },
  };
}
