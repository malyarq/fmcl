export interface AppUpdaterAvailableInfo {
  version?: string;
  tag?: string;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string;
}

export interface AppUpdaterProgress {
  percent?: number;
  transferred?: number;
  total?: number;
}

export interface AppUpdaterAPI {
  check: () => Promise<{ cancelled?: boolean } | null>;
  quitAndInstall: () => void;
  onStatus: (callback: (status: string) => void) => () => void;
  onAvailable: (callback: (info: AppUpdaterAvailableInfo) => void) => () => void;
  onNotAvailable: (callback: (info: unknown) => void) => () => void;
  onError: (callback: (error: string) => void) => () => void;
  onProgress: (callback: (progress: AppUpdaterProgress) => void) => () => void;
  onDownloaded: (callback: (info: { version?: string }) => void) => () => void;
}

