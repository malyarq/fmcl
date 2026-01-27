import { toIpcError } from './ipcError';

type NetworkApi = Window['networkAPI'];
type NamespacedNetworkApi = Window['api']['network'];

function getNetworkApi(): NamespacedNetworkApi | NetworkApi | undefined {
  if (typeof window === 'undefined') return undefined;
  if (window.api?.network) return window.api.network;
  if (window.networkAPI) return window.networkAPI;
  return undefined;
}

function hasNetwork(): boolean {
  return Boolean(getNetworkApi());
}

function hasMethod<K extends keyof NetworkApi>(key: K): boolean {
  const api = getNetworkApi() as NetworkApi | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireNetwork(methodName: string): NetworkApi {
  const api = getNetworkApi() as NetworkApi | undefined;
  if (!api) {
    throw new Error(`[networkIPC] network API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'networkIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const networkIPC = {
  isAvailable(): boolean {
    return hasNetwork();
  },

  has<K extends keyof NetworkApi>(key: K): boolean {
    return hasMethod(key);
  },

  host(port: Parameters<NetworkApi['host']>[0]): ReturnType<NetworkApi['host']> {
    return call('host', () => requireNetwork('host').host(port));
  },
  join(code: Parameters<NetworkApi['join']>[0]): ReturnType<NetworkApi['join']> {
    return call('join', () => requireNetwork('join').join(code));
  },
  stop(): ReturnType<NetworkApi['stop']> {
    return call('stop', () => requireNetwork('stop').stop());
  },
  getMode(): ReturnType<NetworkApi['getMode']> {
    return call('getMode', () => requireNetwork('getMode').getMode());
  },
  setMode(mode: Parameters<NetworkApi['setMode']>[0]): ReturnType<NetworkApi['setMode']> {
    return call('setMode', () => requireNetwork('setMode').setMode(mode));
  },
  ping(host: Parameters<NetworkApi['ping']>[0], port?: Parameters<NetworkApi['ping']>[1]): ReturnType<NetworkApi['ping']> {
    return call('ping', () => requireNetwork('ping').ping(host, port));
  },
  lanStart(): ReturnType<NetworkApi['lanStart']> {
    return call('lanStart', () => requireNetwork('lanStart').lanStart());
  },
  lanStop(): ReturnType<NetworkApi['lanStop']> {
    return call('lanStop', () => requireNetwork('lanStop').lanStop());
  },
  lanBroadcast(motd: Parameters<NetworkApi['lanBroadcast']>[0], port: Parameters<NetworkApi['lanBroadcast']>[1]): ReturnType<NetworkApi['lanBroadcast']> {
    return call('lanBroadcast', () => requireNetwork('lanBroadcast').lanBroadcast(motd, port));
  },
  upnpMapTcp(publicPort: Parameters<NetworkApi['upnpMapTcp']>[0], privatePort: Parameters<NetworkApi['upnpMapTcp']>[1]): ReturnType<NetworkApi['upnpMapTcp']> {
    return call('upnpMapTcp', () => requireNetwork('upnpMapTcp').upnpMapTcp(publicPort, privatePort));
  },
  upnpUnmapTcp(publicPort: Parameters<NetworkApi['upnpUnmapTcp']>[0]): ReturnType<NetworkApi['upnpUnmapTcp']> {
    return call('upnpUnmapTcp', () => requireNetwork('upnpUnmapTcp').upnpUnmapTcp(publicPort));
  },
  onLanDiscover(callback: Parameters<NetworkApi['onLanDiscover']>[0]): ReturnType<NetworkApi['onLanDiscover']> {
    if (!hasMethod('onLanDiscover')) return () => {};
    return requireNetwork('onLanDiscover').onLanDiscover(callback);
  },
};

export type NetworkIPC = typeof networkIPC;
