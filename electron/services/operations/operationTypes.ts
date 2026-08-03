export type OperationKind = 'duplicate' | 'import' | 'install-curseforge' | 'install-modrinth' | 'update' | 'delete' | 'export';

export type OperationMissingItem = string | { path: string; reason: string };

export type OperationPhase =
  | 'started'
  | 'staged'
  | 'validated'
  | 'publish-intent'
  | 'backup-created'
  | 'published'
  | 'control-plane-committed'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovery-required';

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

export type OperationProgress = {
  completed: number;
  total: number;
  message?: string;
};

export type OperationResult =
  | { status: 'succeeded'; instanceId: string }
  | { status: 'recovered'; instanceId?: string }
  | { status: 'degraded'; instanceId?: string; missing: OperationMissingItem[] }
  | { status: 'cancelled' }
  | { status: 'failed'; code: string; message: string }
  | { status: 'recovery-required'; message: string };

export type DuplicateOperationInput = {
  kind: 'duplicate';
  rootPath: string;
  sourceId: string;
  destinationId?: string;
  name?: string;
};

export type ImportOperationInput = {
  kind: 'import';
  rootPath: string;
  filePath: string;
  destinationId?: string;
  name?: string;
};

export type CurseForgeInstallOperationInput = {
  kind: 'install-curseforge';
  rootPath: string;
  projectId: number;
  fileId: number;
  destinationId?: string;
  name?: string;
};

export type ModrinthInstallOperationInput = {
  kind: 'install-modrinth';
  rootPath: string;
  projectId: string;
  versionId: string;
  destinationId?: string;
  name?: string;
};

export type UpdateOperationInput = {
  kind: 'update';
  rootPath: string;
  instanceId: string;
  manifestUrl: string;
};

export type DeleteOperationInput = {
  kind: 'delete';
  rootPath: string;
  instanceId: string;
};

export type ArchiveExportOperationInput = {
  kind: 'export';
  rootPath: string;
  instanceId: string;
  format: 'zip' | 'multimc';
  outputPath: string;
  options?: {
    includeSaves?: boolean;
    includeScreenshots?: boolean;
    includeResourcePacks?: boolean;
    includeShaders?: boolean;
    includeMods?: boolean;
  };
};

export type ManifestExportOperationInput = {
  kind: 'export';
  rootPath: string;
  instanceId: string;
  format: 'manifest';
  name: string;
  version: string;
  author?: string;
};

export type ExportOperationInput = ArchiveExportOperationInput | ManifestExportOperationInput;

export type OperationInput = DuplicateOperationInput | ImportOperationInput | CurseForgeInstallOperationInput | ModrinthInstallOperationInput | UpdateOperationInput | DeleteOperationInput | ExportOperationInput;

export type DuplicateRecoveryData = {
  sourceId: string;
  destinationId: string;
  destinationName: string;
};

export type ImportRecoveryData = {
  destinationId: string;
  destinationName: string;
  missing: OperationMissingItem[];
  /** Provider metadata is persisted so a published install can be committed idempotently after restart. */
  metadata?: Record<string, unknown>;
};

export type UpdateRecoveryData = {
  destinationId: string;
};

export type DeleteRecoveryData = {
  destinationId: string;
};

export type ArchiveRecoveryData = {
  outputPath: string;
  workspacePath: string;
  stagedPath: string;
  backupPath: string;
  hadOutput: boolean;
  digest?: string;
};

export type OperationRecoveryData = (DuplicateRecoveryData | ImportRecoveryData | UpdateRecoveryData | DeleteRecoveryData | ArchiveRecoveryData) & {
  /** Durable evidence needed to undo a pre-control-plane destination swap. */
  publishIntent?: { destinationId: string; destinationExisted: boolean };
};

export type OperationSnapshot = {
  id: string;
  kind: OperationKind;
  rootPath: string;
  instanceId?: string;
  status: OperationStatus;
  phase: OperationPhase;
  progress: OperationProgress;
  createdAt: string;
  updatedAt: string;
  input: OperationInput;
  result?: OperationResult;
  recovery?: OperationRecoveryData;
};

export type OperationContext = {
  snapshot: OperationSnapshot;
  isCancelled(): boolean;
  transition(phase: OperationPhase, progress?: Partial<OperationProgress>): void;
  setRecoveryData(data: OperationRecoveryData): void;
  setPublishIntent(destinationId: string, destinationExisted: boolean, progress?: Partial<OperationProgress>): void;
};

export type OperationAdapter = {
  kind: OperationKind;
  run(context: OperationContext): Promise<OperationResult>;
  recoverPublished?(context: OperationContext): Promise<OperationResult>;
};

export function isTerminalStatus(status: OperationStatus): boolean {
  return ['succeeded', 'recovered', 'degraded', 'cancelled', 'failed', 'recovery-required'].includes(status);
}

export function isTerminalPhase(phase: OperationPhase): boolean {
  return ['completed', 'failed', 'cancelled', 'recovery-required'].includes(phase);
}
