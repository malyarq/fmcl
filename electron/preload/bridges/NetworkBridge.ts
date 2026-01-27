import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type { LanDiscoverEvent, NetworkAPI, NetworkMode } from '@shared/contracts'

export const networkAPI: NetworkAPI = {
  host: (port: number) => ipcRenderer.invoke('network:host', port),
  join: (code: string) => ipcRenderer.invoke('network:join', code),
  stop: () => ipcRenderer.invoke('network:stop'),
  // Step 6: mode switching + XMCL utilities
  getMode: () => ipcRenderer.invoke('network:getMode'),
  setMode: (mode: NetworkMode) => ipcRenderer.invoke('network:setMode', mode),
  ping: (host: string, port?: number) => ipcRenderer.invoke('network:ping', host, port),
  lanStart: () => ipcRenderer.invoke('network:lanStart'),
  lanStop: () => ipcRenderer.invoke('network:lanStop'),
  lanBroadcast: (motd: string, port: number) => ipcRenderer.invoke('network:lanBroadcast', motd, port),
  upnpMapTcp: (publicPort: number, privatePort: number) => ipcRenderer.invoke('network:upnpMapTcp', publicPort, privatePort),
  upnpUnmapTcp: (publicPort: number) => ipcRenderer.invoke('network:upnpUnmapTcp', publicPort),
  onLanDiscover: (callback: (e: LanDiscoverEvent) => void) => {
    const subscription = (_event: IpcRendererEvent, data: LanDiscoverEvent) => callback(data)
    ipcRenderer.on('network:lan-discover', subscription)
    return () => ipcRenderer.removeListener('network:lan-discover', subscription)
  },
}
