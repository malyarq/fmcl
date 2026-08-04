/**
 * An opaque authority issued only by a main-process root resolver.
 *
 * It intentionally carries no path-like data, so it cannot be reconstructed
 * from a renderer DTO or passed across the preload boundary.
 */
declare const launcherRootBrand: unique symbol;

export type LauncherRoot = Readonly<{
  readonly [launcherRootBrand]: 'LauncherRoot';
}>;

export type InstanceSource = 'local' | 'curseforge' | 'modrinth';

export type InstanceLoader = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge';

export type InstanceRuntime = Readonly<{
  minecraftVersion: string;
  modLoader?: Readonly<{
    type: InstanceLoader;
    version?: string;
  }>;
}>;

export type InstanceEditableConfig = Readonly<{
  runtime: InstanceRuntime;
  java?: Readonly<{
    executable?: string;
  }>;
  memory?: Readonly<{
    maxMb: number;
    minMb?: number;
  }>;
  vmOptions?: readonly string[];
  game?: Readonly<{
    resolution?: Readonly<{
      width?: number;
      height?: number;
      fullscreen?: boolean;
    }>;
    extraArgs?: readonly string[];
    useOptiFine?: boolean;
  }>;
  server?: Readonly<{
    host: string;
    port: number;
  }>;
  networkMode?: 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';
}>;

export type InstanceSourceMetadata = Readonly<{
  source: InstanceSource;
  sourceId?: string;
  sourceVersionId?: string;
  version?: string;
  iconUrl?: string;
  description?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type InstanceSummary = Readonly<{
  minecraftVersion: string;
  modLoader?: Readonly<{
    type: InstanceLoader;
    version?: string;
  }>;
}>;

/** The only record shape exchanged by the canonical instance control plane. */
export type CanonicalInstanceRecord = Readonly<{
  id: string;
  name: string;
  source: InstanceSourceMetadata;
  config: InstanceEditableConfig;
  summary: InstanceSummary;
}>;

/**
 * `selectedId` is null exactly when `records` is empty; otherwise it names a
 * record in the same snapshot. The application validates this invariant before
 * every persistence commit.
 */
export type CanonicalInstanceSnapshot = Readonly<{
  selectedId: string | null;
  records: readonly CanonicalInstanceRecord[];
}>;

export type InstanceControlPlaneRead =
  | Readonly<{ status: 'uninitialized' }>
  | Readonly<{ status: 'ready'; snapshot: CanonicalInstanceSnapshot }>;

export type InstanceCreateCommand = Readonly<{
  version: 1;
  type: 'create';
  name: string;
  source: Readonly<Omit<InstanceSourceMetadata, 'createdAt' | 'updatedAt'>>;
  config: InstanceEditableConfig;
}>;

export type InstanceRenameCommand = Readonly<{
  version: 1;
  type: 'rename';
  id: string;
  name: string;
}>;

export type InstanceSelectCommand = Readonly<{
  version: 1;
  type: 'select';
  id: string;
}>;

export type InstanceSaveConfigCommand = Readonly<{
  version: 1;
  type: 'save-config';
  id: string;
  config: InstanceEditableConfig;
}>;

export type InstanceUpdateMetadataCommand = Readonly<{
  version: 1;
  type: 'update-metadata';
  id: string;
  /** Undefined deliberately clears the optional canonical description. */
  description?: string;
}>;

export type InstanceCommitPublishedCommand = Readonly<{
  version: 1;
  type: 'commit-published';
  record: CanonicalInstanceRecord;
  select?: boolean;
}>;

export type InstanceReconcileUpdateCommand = Readonly<{
  version: 1;
  type: 'reconcile-update';
  record: CanonicalInstanceRecord;
}>;

export type InstanceDeleteCommand = Readonly<{
  version: 1;
  type: 'delete';
  id: string;
}>;

export type InstanceCommand =
  | InstanceCreateCommand
  | InstanceRenameCommand
  | InstanceSelectCommand
  | InstanceSaveConfigCommand
  | InstanceUpdateMetadataCommand
  | InstanceCommitPublishedCommand
  | InstanceReconcileUpdateCommand
  | InstanceDeleteCommand;

export type InstanceCommandResult = Readonly<{
  status: 'committed' | 'noop';
  snapshot: CanonicalInstanceSnapshot;
}>;
