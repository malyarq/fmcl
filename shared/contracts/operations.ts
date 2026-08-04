export type OperationKind = 'duplicate' | 'import' | 'import-share' | 'install-curseforge' | 'install-modrinth' | 'update' | 'delete' | 'export';

export type OperationMissingItem = string | { path: string; reason: string };

export type OperationProgress = {
  completed: number;
  total: number;
  message?: string;
};

export type OperationStatus =
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'succeeded'
  | 'recovered'
  | 'degraded'
  | 'cancelled'
  | 'failed'
  | 'recovery-required';

export type OperationPhase =
  | 'started'
  | 'staged'
  | 'validated'
  /** Durable intent written before the first destructive rename. */
  | 'publish-intent'
  | 'backup-created'
  | 'published'
  | 'control-plane-committed'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovery-required';

export type OperationResult =
  | { status: 'succeeded'; instanceId: string }
  | { status: 'recovered'; instanceId?: string }
  | { status: 'degraded'; instanceId?: string; missing: OperationMissingItem[] }
  | { status: 'cancelled' }
  | { status: 'failed'; code: string; message: string }
  | { status: 'recovery-required'; message: string };

export type DuplicateOperationRequest = {
  kind: 'duplicate';
  sourceId: string;
  destinationId?: string;
  name?: string;
};

export type ImportOperationRequest = {
  kind: 'import';
  /** Opaque capability returned by main-owned archive inspection. */
  archiveRef: string;
  destinationId?: string;
  name?: string;
};

/** A share code is untrusted renderer text; main resolves its manifest internally. */
export type ShareImportOperationRequest = {
  kind: 'import-share';
  code: string;
};

export type CurseForgeInstallOperationRequest = {
  kind: 'install-curseforge';
  projectId: number;
  fileId: number;
  destinationId?: string;
  name?: string;
};

export type ModrinthInstallOperationRequest = {
  kind: 'install-modrinth';
  projectId: string;
  versionId: string;
  destinationId?: string;
  name?: string;
};

export type UpdateOperationRequest = {
  kind: 'update';
  instanceId: string;
  manifestUrl: string;
};

export type DeleteOperationRequest = {
  kind: 'delete';
  instanceId: string;
};

export type ArchiveExportOperationRequest = {
  kind: 'export';
  instanceId: string;
  format: 'zip' | 'multimc';
  /** Untrusted native-dialog path proof; the main process consumes its authorization before use. */
  outputPath: string;
  options?: {
    includeSaves?: boolean;
    includeScreenshots?: boolean;
    includeResourcePacks?: boolean;
    includeShaders?: boolean;
    includeMods?: boolean;
  };
};

/** Generates and publishes manifest metadata for an existing instance without a renderer file path. */
export type ManifestExportOperationRequest = {
  kind: 'export';
  instanceId: string;
  format: 'manifest';
  name: string;
  version: string;
  author?: string;
};

export type ExportOperationRequest = ArchiveExportOperationRequest | ManifestExportOperationRequest;

export type OperationStartRequest = DuplicateOperationRequest | ImportOperationRequest | ShareImportOperationRequest | CurseForgeInstallOperationRequest | ModrinthInstallOperationRequest | UpdateOperationRequest | DeleteOperationRequest | ExportOperationRequest;

/** Serializable snapshot intentionally excludes internal roots, inputs and recovery data. */
export type OperationSnapshot = {
  id: string;
  kind: OperationKind;
  status: OperationStatus;
  phase: OperationPhase;
  progress: OperationProgress;
  createdAt: string;
  updatedAt: string;
  result?: OperationResult;
};

export type OperationsAPI = {
  start(input: OperationStartRequest): Promise<OperationSnapshot>;
  get(id: string): Promise<OperationSnapshot | null>;
  listRecovered(): Promise<OperationSnapshot[]>;
  cancel(id: string): Promise<{ cancelled: boolean }>;
  subscribe(id: string, listener: (snapshot: OperationSnapshot) => void): Promise<() => void>;
};
