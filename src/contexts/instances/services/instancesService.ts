import type { InstanceConfigDto, InstanceMetadataDto, InstanceResult } from '@shared/contracts';
import { instancesIPC } from '../../../services/ipc/instancesIPC';
import type { ModpackConfig, ModpackListItem } from '../types';
import type { ModpackMetadata } from '@shared/types/modpack';

function valueOf<T>(result: InstanceResult<T>): T {
  if (result.ok) return result.value;

  const error = new Error(result.error.message);
  error.name = result.error.code;
  throw error;
}

function toModpackConfig(
  id: string,
  name: string,
  config: InstanceConfigDto,
  metadata?: InstanceMetadataDto,
): ModpackConfig {
  return {
    id,
    name,
    runtime: {
      minecraft: config.runtime.minecraftVersion,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
    ...(config.memory === undefined ? {} : { memory: { ...config.memory } }),
    ...(config.vmOptions === undefined ? {} : { vmOptions: [...config.vmOptions] }),
    ...(config.game === undefined ? {} : {
      game: {
        ...(config.game.resolution === undefined ? {} : { resolution: { ...config.game.resolution } }),
        ...(config.game.extraArgs === undefined ? {} : { extraArgs: [...config.game.extraArgs] }),
        ...(config.game.useOptiFine === undefined ? {} : { useOptiFine: config.game.useOptiFine }),
      },
    }),
    ...(config.server === undefined ? {} : { server: { ...config.server } }),
    ...(config.networkMode === undefined ? {} : { networkMode: config.networkMode }),
    ...(metadata === undefined ? {} : { createdAt: metadata.createdAt, updatedAt: metadata.updatedAt }),
  };
}

export function toModpackMetadata(
  id: string,
  name: string,
  config: InstanceConfigDto,
  metadata: InstanceMetadataDto,
): ModpackMetadata {
  return {
    id,
    name,
    source: metadata.source,
    ...(metadata.sourceId === undefined ? {} : { sourceId: metadata.sourceId }),
    ...(metadata.sourceVersionId === undefined ? {} : { sourceVersionId: metadata.sourceVersionId }),
    ...(metadata.version === undefined ? {} : { version: metadata.version }),
    ...(metadata.iconUrl === undefined ? {} : { iconUrl: metadata.iconUrl }),
    ...(metadata.description === undefined ? {} : { description: metadata.description }),
    ...(metadata.author === undefined ? {} : { author: metadata.author }),
    minecraftVersion: config.runtime.minecraftVersion,
    ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}

function toInstanceConfig(config: ModpackConfig): InstanceConfigDto {
  return {
    runtime: {
      minecraftVersion: config.runtime.minecraft,
      ...(config.runtime.modLoader === undefined ? {} : { modLoader: { ...config.runtime.modLoader } }),
    },
    ...(config.memory === undefined ? {} : { memory: { ...config.memory } }),
    ...(config.vmOptions === undefined ? {} : { vmOptions: [...config.vmOptions] }),
    ...(config.game === undefined ? {} : {
      game: {
        ...(config.game.resolution === undefined ? {} : { resolution: { ...config.game.resolution } }),
        ...(config.game.extraArgs === undefined ? {} : { extraArgs: [...config.game.extraArgs] }),
        ...(config.game.useOptiFine === undefined ? {} : { useOptiFine: config.game.useOptiFine }),
      },
    }),
    ...(config.server === undefined ? {} : { server: { ...config.server } }),
    ...(config.networkMode === undefined ? {} : { networkMode: config.networkMode }),
  };
}

function defaultLocalInstanceConfig(): InstanceConfigDto {
  return {
    runtime: { minecraftVersion: '1.12.2', modLoader: { type: 'vanilla' } },
    memory: { maxMb: 4096 },
    vmOptions: [],
  };
}

export async function fetchModpackConfig(id: string): Promise<ModpackConfig> {
  const snapshot = valueOf(await instancesIPC.snapshot({ id }));
  return toModpackConfig(snapshot.id, snapshot.name, snapshot.config, snapshot.metadata);
}

export async function fetchModpackMetadata(id: string): Promise<ModpackMetadata> {
  const snapshot = valueOf(await instancesIPC.snapshot({ id }));
  return toModpackMetadata(snapshot.id, snapshot.name, snapshot.config, snapshot.metadata);
}

export async function listModpacks(): Promise<ModpackListItem[]> {
  const response = valueOf(await instancesIPC.list());
  if (response.status === 'uninitialized') return [];

  return response.instances.map(({ id, name, selected }) => ({
    id,
    name,
    selected,
  }));
}

export async function getSelectedModpackId(): Promise<string | null> {
  const response = valueOf(await instancesIPC.list());
  if (response.status === 'uninitialized') return null;
  return response.instances.find((instance) => instance.selected)?.id ?? null;
}

export async function setSelectedModpackId(id: string): Promise<void> {
  valueOf(await instancesIPC.select({ id }));
}

export async function createModpack(name: string): Promise<{ id?: string } | null> {
  const mutation = valueOf(await instancesIPC.create({
    name,
    source: { source: 'local' },
    config: defaultLocalInstanceConfig(),
  }));

  return mutation.selectedId === null ? null : { id: mutation.selectedId };
}

export async function renameModpack(id: string, name: string): Promise<void> {
  valueOf(await instancesIPC.rename({ id, name }));
}

export async function saveModpackConfig(config: ModpackConfig): Promise<void> {
  valueOf(await instancesIPC.config({ action: 'save', id: config.id, config: toInstanceConfig(config) }));
}

/** Reads canonical readiness and the selected snapshot without a renderer seed or root. */
export async function bootstrapModpacksIfSupported(): Promise<{ selectedId: string; config: ModpackConfig } | null> {
  const prepared = valueOf(await instancesIPC.prepare());
  if (prepared.status === 'uninitialized') return null;

  const selectedId = await getSelectedModpackId();
  if (selectedId === null) return null;

  return { selectedId, config: await fetchModpackConfig(selectedId) };
}
