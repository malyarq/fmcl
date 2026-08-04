import { ipcRenderer } from 'electron'
import { INSTANCE_CHANNELS, type InstancesAPI } from '@shared/contracts'

/** The only preload surface for canonical, renderer-safe instance commands. */
export const instances: InstancesAPI = {
  list: () => ipcRenderer.invoke(INSTANCE_CHANNELS.list, {}),
  snapshot: (request) => ipcRenderer.invoke(INSTANCE_CHANNELS.snapshot, request),
  select: (request) => ipcRenderer.invoke(INSTANCE_CHANNELS.select, request),
  create: (request) => ipcRenderer.invoke(INSTANCE_CHANNELS.create, request),
  rename: (request) => ipcRenderer.invoke(INSTANCE_CHANNELS.rename, request),
  config: (request) => ipcRenderer.invoke(INSTANCE_CHANNELS.config, request),
  metadata: (request) => ipcRenderer.invoke(INSTANCE_CHANNELS.metadata, request),
  prepare: () => ipcRenderer.invoke(INSTANCE_CHANNELS.prepare, {}),
}
