import type { ArchiveInspectionResponse, FriendLauncherApi } from '@shared/contracts';
import { toIpcError } from './ipcError';

type ArchiveInspectionApi = FriendLauncherApi['archiveInspection'];

function api(): ArchiveInspectionApi {
  const archiveInspection = typeof window !== 'undefined' ? window.api?.archiveInspection : undefined;
  if (!archiveInspection) throw new Error('[archiveInspectionIPC] archive inspection API is not available');
  return archiveInspection;
}

export const archiveInspectionIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.archiveInspection),
  select: async (): Promise<ArchiveInspectionResponse> => {
    try {
      return await api().select();
    } catch (error) {
      const ipcError = toIpcError({ namespace: 'archiveInspectionIPC', method: 'select' }, error);
      console.error(ipcError);
      throw ipcError;
    }
  },
};
