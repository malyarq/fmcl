import type { Screenshot } from '../types/screenshots';

export interface ScreenshotsAPI {
  list: (instanceId: string) => Promise<Screenshot[]>;
  delete: (fileName: string, instanceId: string) => Promise<{ ok: boolean }>;
  rename: (oldName: string, newName: string, instanceId: string) => Promise<{ ok: boolean }>;
  openFolder: (instanceId: string) => Promise<{ ok: boolean }>;
}
