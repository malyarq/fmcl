/**
 * Renderer-safe control-plane transport for canonical instances.
 *
 * These DTOs intentionally describe instance state, never local filesystem
 * capabilities. Main resolves the default launcher authority separately.
 */
export const INSTANCE_CHANNELS = {
  list: 'instances:list',
  snapshot: 'instances:snapshot',
  select: 'instances:select',
  create: 'instances:create',
  rename: 'instances:rename',
  config: 'instances:config',
  metadata: 'instances:metadata',
  prepare: 'instances:prepare',
} as const;

export type InstanceChannel = (typeof INSTANCE_CHANNELS)[keyof typeof INSTANCE_CHANNELS];

export type InstanceLoaderDto = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge';

export type InstanceRuntimeDto = Readonly<{
  minecraftVersion: string;
  modLoader?: Readonly<{ type: InstanceLoaderDto; version?: string }>;
}>;

export type InstanceConfigDto = Readonly<{
  runtime: InstanceRuntimeDto;
  memory?: Readonly<{ maxMb: number; minMb?: number }>;
  vmOptions?: readonly string[];
  game?: Readonly<{
    resolution?: Readonly<{ width?: number; height?: number; fullscreen?: boolean }>;
    extraArgs?: readonly string[];
    useOptiFine?: boolean;
  }>;
  server?: Readonly<{ host: string; port: number }>;
  networkMode?: 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';
}>;

export type InstanceSourceDto = Readonly<{
  source: 'local' | 'curseforge' | 'modrinth';
  sourceId?: string;
  sourceVersionId?: string;
  version?: string;
  iconUrl?: string;
  description?: string;
  author?: string;
}>;

export type InstanceMetadataDto = Readonly<{
  source: InstanceSourceDto['source'];
  sourceId?: string;
  sourceVersionId?: string;
  version?: string;
  iconUrl?: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}>;

/** The renderer may change only the user-authored description; source identity stays main-owned. */
export type InstanceMetadataUpdate = Readonly<{
  description: string | null;
}>;

export type InstanceSummaryDto = Readonly<{
  minecraftVersion: string;
  modLoader?: Readonly<{ type: InstanceLoaderDto; version?: string }>;
}>;

export type InstanceListItemDto = Readonly<{
  id: string;
  name: string;
  selected: boolean;
  summary: InstanceSummaryDto;
}>;

export type InstanceSnapshotDto = Readonly<{
  id: string;
  name: string;
  metadata: InstanceMetadataDto;
  config: InstanceConfigDto;
  summary: InstanceSummaryDto;
}>;

export type InstanceListRequest = Readonly<Record<never, never>>;
export type InstanceSnapshotRequest = Readonly<{ id: string }>;
export type InstanceSelectRequest = Readonly<{ id: string }>;
export type InstanceCreateRequest = Readonly<{ name: string; source: InstanceSourceDto; config: InstanceConfigDto }>;
export type InstanceRenameRequest = Readonly<{ id: string; name: string }>;
export type InstanceConfigRequest =
  | Readonly<{ action: 'get'; id: string }>
  | Readonly<{ action: 'save'; id: string; config: InstanceConfigDto }>;
export type InstanceMetadataRequest = Readonly<{ id: string }>
  | Readonly<{ action: 'save'; id: string; metadata: InstanceMetadataUpdate }>;
export type InstancePrepareRequest = Readonly<Record<never, never>>;

export type InstanceFailure = Readonly<{
  code: 'INSTANCE_UNAVAILABLE' | 'INSTANCE_UNINITIALIZED' | 'INSTANCE_NOT_FOUND';
  message: string;
}>;

export type InstanceResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: InstanceFailure }>;

export type InstanceListResponse = Readonly<{ status: 'ready'; instances: readonly InstanceListItemDto[] }> | Readonly<{ status: 'uninitialized' }>;
export type InstanceSnapshotResponse = InstanceSnapshotDto;
export type InstanceConfigResponse = InstanceConfigDto;
export type InstanceMetadataResponse = InstanceMetadataDto;
export type InstancePrepareResponse = Readonly<{ status: 'ready' | 'uninitialized' }>;
export type InstanceMutationResponse = Readonly<{
  status: 'committed' | 'noop';
  selectedId: string | null;
  instances: readonly InstanceListItemDto[];
}>;

/** Typed preload capability for the canonical, path-free instance control plane. */
export type InstancesAPI = Readonly<{
  list(): Promise<InstanceResult<InstanceListResponse>>;
  snapshot(request: InstanceSnapshotRequest): Promise<InstanceResult<InstanceSnapshotResponse>>;
  select(request: InstanceSelectRequest): Promise<InstanceResult<InstanceMutationResponse>>;
  create(request: InstanceCreateRequest): Promise<InstanceResult<InstanceMutationResponse>>;
  rename(request: InstanceRenameRequest): Promise<InstanceResult<InstanceMutationResponse>>;
  config(request: InstanceConfigRequest): Promise<InstanceResult<InstanceConfigResponse | InstanceMutationResponse>>;
  metadata(request: InstanceMetadataRequest): Promise<InstanceResult<InstanceMetadataResponse | InstanceMutationResponse>>;
  prepare(): Promise<InstanceResult<InstancePrepareResponse>>;
}>;
