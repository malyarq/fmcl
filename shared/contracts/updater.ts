export interface InstanceUpdaterProgress {
  status: string;
  progress: number;
}

export interface InstanceUpdaterSyncOptions {
  rootPath?: string;
  instanceId?: string;
}

export interface InstanceUpdaterAPI {
  /**
   * Sync instance files using a remote manifest.
   *
   * Backward compatible call forms:
   * - `sync(manifestUrl)`
   * - `sync(manifestUrl, rootPath)` (legacy)
   * - `sync(manifestUrl, options)` (preferred)
   */
  sync: (manifestUrl: string, optionsOrRootPath?: InstanceUpdaterSyncOptions | string) => Promise<void>;
  onProgress: (callback: (data: InstanceUpdaterProgress) => void) => () => void;
}

