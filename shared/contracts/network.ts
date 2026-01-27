export type NetworkMode = 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';

export interface LanDiscoverEvent {
  motd: string;
  port: number;
  address: string;
}

export interface NetworkAPI {
  host: (port: number) => Promise<string>;
  join: (code: string) => Promise<number>;
  stop: () => Promise<void>;

  getMode: () => Promise<NetworkMode>;
  setMode: (mode: NetworkMode) => Promise<{ ok: boolean }>;

  ping: (host: string, port?: number) => Promise<unknown>;
  lanStart: () => Promise<{ ok: boolean }>;
  lanStop: () => Promise<{ ok: boolean }>;
  lanBroadcast: (motd: string, port: number) => Promise<{ ok: boolean }>;
  upnpMapTcp: (publicPort: number, privatePort: number) => Promise<{ externalIp: string }>;
  upnpUnmapTcp: (publicPort: number) => Promise<boolean>;

  onLanDiscover: (callback: (e: LanDiscoverEvent) => void) => () => void;
}

