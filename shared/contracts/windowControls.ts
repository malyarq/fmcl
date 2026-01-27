export interface WindowControlsAPI {
  minimize: () => Promise<void>;
  close: () => Promise<void>;
}

