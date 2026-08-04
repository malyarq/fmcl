import { ipcRenderer } from 'electron';
import type { InstanceModRegistrationRequest, InstanceModsAPI } from '@shared/contracts/instanceMods';

export const instanceMods: InstanceModsAPI = {
  list: (instanceId: string) => ipcRenderer.invoke('instance-mods:list', instanceId),
  remove: (instanceId: string, fileName: string) => ipcRenderer.invoke('instance-mods:remove', instanceId, fileName),
  setEnabled: (instanceId: string, fileName: string, enabled: boolean) => ipcRenderer.invoke(
    'instance-mods:setEnabled',
    instanceId,
    fileName,
    enabled,
  ),
  register: (instanceId: string, request: InstanceModRegistrationRequest) => ipcRenderer.invoke(
    'instance-mods:register',
    instanceId,
    request,
  ),
};
