export interface WindowControlsAPI {
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  openConsole: () => Promise<void>;
  closeConsole: () => Promise<void>;
}

