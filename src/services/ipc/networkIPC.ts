import { toIpcError } from './ipcError';

type NetworkApi = Window['api']['network'];

function api(): NetworkApi {
  if (typeof window === 'undefined' || !window.api?.network) throw new Error('[networkIPC] network API is not available');
  return window.api.network;
}

async function call<T>(method: string, work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) { throw toIpcError({ namespace: 'networkIPC', method }, error); }
}

export const networkIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.network),
  tunnel: {
    getState: () => call('tunnel.getState', () => api().tunnel.getState()),
    host: (request: Parameters<NetworkApi['tunnel']['host']>[0]) => call('tunnel.host', () => api().tunnel.host(request)),
    join: (request: Parameters<NetworkApi['tunnel']['join']>[0]) => call('tunnel.join', () => api().tunnel.join(request)),
    stop: () => call('tunnel.stop', () => api().tunnel.stop()),
    onState: (callback: Parameters<NetworkApi['tunnel']['onState']>[0]) => api().tunnel.onState(callback),
  },
  lan: {
    getState: () => call('lan.getState', () => api().lan.getState()),
    start: (request?: Parameters<NetworkApi['lan']['start']>[0]) => call('lan.start', () => api().lan.start(request)),
    stop: () => call('lan.stop', () => api().lan.stop()),
    broadcast: (request: Parameters<NetworkApi['lan']['broadcast']>[0]) => call('lan.broadcast', () => api().lan.broadcast(request)),
    ping: (request: Parameters<NetworkApi['lan']['ping']>[0]) => call('lan.ping', () => api().lan.ping(request)),
    onState: (callback: Parameters<NetworkApi['lan']['onState']>[0]) => api().lan.onState(callback),
    onDiscover: (callback: Parameters<NetworkApi['lan']['onDiscover']>[0]) => api().lan.onDiscover(callback),
  },
  upnp: {
    getState: () => call('upnp.getState', () => api().upnp.getState()),
    mapTcp: (request: Parameters<NetworkApi['upnp']['mapTcp']>[0]) => call('upnp.mapTcp', () => api().upnp.mapTcp(request)),
    unmapTcp: (request: Parameters<NetworkApi['upnp']['unmapTcp']>[0]) => call('upnp.unmapTcp', () => api().upnp.unmapTcp(request)),
    stop: () => call('upnp.stop', () => api().upnp.stop()),
    onState: (callback: Parameters<NetworkApi['upnp']['onState']>[0]) => api().upnp.onState(callback),
  },
};

export type NetworkIPC = typeof networkIPC;
