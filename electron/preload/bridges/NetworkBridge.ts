import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { NETWORK_CHANNELS, type NetworkAPI } from '@shared/contracts';

function subscription<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

export const networkAPI: NetworkAPI = {
  tunnel: {
    getState: () => ipcRenderer.invoke(NETWORK_CHANNELS.tunnelGetState),
    host: (request) => ipcRenderer.invoke(NETWORK_CHANNELS.tunnelHost, request),
    join: (request) => ipcRenderer.invoke(NETWORK_CHANNELS.tunnelJoin, request),
    stop: () => ipcRenderer.invoke(NETWORK_CHANNELS.tunnelStop),
    onState: (callback) => subscription(NETWORK_CHANNELS.tunnelState, callback),
  },
  lan: {
    getState: () => ipcRenderer.invoke(NETWORK_CHANNELS.lanGetState),
    start: (request) => ipcRenderer.invoke(NETWORK_CHANNELS.lanStart, request),
    stop: () => ipcRenderer.invoke(NETWORK_CHANNELS.lanStop),
    broadcast: (request) => ipcRenderer.invoke(NETWORK_CHANNELS.lanBroadcast, request),
    ping: (request) => ipcRenderer.invoke(NETWORK_CHANNELS.lanPing, request),
    onState: (callback) => subscription(NETWORK_CHANNELS.lanState, callback),
    onDiscover: (callback) => subscription(NETWORK_CHANNELS.lanDiscover, callback),
  },
  upnp: {
    getState: () => ipcRenderer.invoke(NETWORK_CHANNELS.upnpGetState),
    mapTcp: (request) => ipcRenderer.invoke(NETWORK_CHANNELS.upnpMapTcp, request),
    unmapTcp: (request) => ipcRenderer.invoke(NETWORK_CHANNELS.upnpUnmapTcp, request),
    stop: () => ipcRenderer.invoke(NETWORK_CHANNELS.upnpStop),
    onState: (callback) => subscription(NETWORK_CHANNELS.upnpState, callback),
  },
};
