import { ipcRenderer } from 'electron'
import type { WorldsAPI } from '@shared/contracts'

export const worlds: WorldsAPI = {
  listByInstanceId: (instanceId) => ipcRenderer.invoke('worlds:listByInstanceId', instanceId),
  deleteByInstanceId: (folderName, instanceId) => ipcRenderer.invoke('worlds:deleteByInstanceId', folderName, instanceId),
  backupByInstanceId: (folderName, instanceId) => ipcRenderer.invoke('worlds:backupByInstanceId', folderName, instanceId),
  duplicateByInstanceId: (folderName, instanceId) => ipcRenderer.invoke('worlds:duplicateByInstanceId', folderName, instanceId),
  openFolderByInstanceId: (folderName, instanceId) => ipcRenderer.invoke('worlds:openFolderByInstanceId', folderName, instanceId),
}
