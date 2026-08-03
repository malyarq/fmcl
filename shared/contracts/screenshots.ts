import type { Screenshot } from '../types/screenshots';

export interface ScreenshotsAPI {
  list: (instancePath: string) => Promise<Screenshot[]>;
  delete: (fileName: string, instancePath: string) => Promise<{ ok: boolean }>;
  rename: (oldName: string, newName: string, instancePath: string) => Promise<{ ok: boolean }>;
  openFolder: (instancePath: string) => Promise<{ ok: boolean }>;
}
