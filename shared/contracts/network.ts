export const NETWORK_CHANNELS = {
  tunnelState: 'network:tunnel:state',
  tunnelGetState: 'network:tunnel:get-state',
  tunnelHost: 'network:tunnel:host',
  tunnelJoin: 'network:tunnel:join',
  tunnelStop: 'network:tunnel:stop',
  lanState: 'network:lan:state',
  lanDiscover: 'network:lan:discover',
  lanGetState: 'network:lan:get-state',
  lanStart: 'network:lan:start',
  lanStop: 'network:lan:stop',
  lanBroadcast: 'network:lan:broadcast',
  lanPing: 'network:lan:ping',
  upnpState: 'network:upnp:state',
  upnpGetState: 'network:upnp:get-state',
  upnpMapTcp: 'network:upnp:map-tcp',
  upnpUnmapTcp: 'network:upnp:unmap-tcp',
  upnpStop: 'network:upnp:stop',
} as const;

export type NetworkChannel = typeof NETWORK_CHANNELS[keyof typeof NETWORK_CHANNELS];
export type NetworkLifecycleState = 'idle' | 'starting' | 'active' | 'stopping' | 'failed';

export type NetworkDiagnosticCode =
  | 'INVALID_REQUEST'
  | 'TUNNEL_DISCOVERY_FAILED'
  | 'TUNNEL_LISTEN_FAILED'
  | 'TUNNEL_PEER_UNAVAILABLE'
  | 'TUNNEL_PROTOCOL_VIOLATION'
  | 'TUNNEL_CLEANUP_FAILED'
  | 'LAN_BIND_FAILED'
  | 'LAN_BROADCAST_FAILED'
  | 'LAN_PING_FAILED'
  | 'LAN_CLEANUP_FAILED'
  | 'UPNP_GATEWAY_NOT_FOUND'
  | 'UPNP_MAPPING_FAILED'
  | 'UPNP_UNMAP_FAILED'
  | 'UPNP_CLEANUP_FAILED'
  | 'NETWORK_UNAVAILABLE';

export interface NetworkDiagnostic {
  code: NetworkDiagnosticCode;
  message: string;
}

interface NetworkSnapshotBase {
  revision: number;
  state: NetworkLifecycleState;
  diagnostic?: NetworkDiagnostic;
}

export interface BurrowLinkSnapshot extends NetworkSnapshotBase {
  role: 'host' | 'join' | null;
  roomCode?: string;
  localPort?: number;
  peerCount: number;
}

export interface LanDiscoverySnapshot extends NetworkSnapshotBase {
  family: 'udp4' | 'udp6' | null;
  discoveredCount: number;
}

export interface PortMappingDto {
  publicPort: number;
  privatePort: number;
  externalIp: string;
}

export interface PortMappingSnapshot extends NetworkSnapshotBase {
  mappings: readonly PortMappingDto[];
}

export interface LanDiscoverEvent {
  motd: string;
  port: number;
  address: string;
}

export interface MinecraftServerStatus {
  description: string;
  versionName: string;
  protocol: number;
  onlinePlayers: number;
  maxPlayers: number;
  latencyMs: number;
}

export type MinecraftServerStatusResult =
  | { status: 'ok'; server: MinecraftServerStatus }
  | { status: 'failed'; diagnostic: NetworkDiagnostic };

export interface BurrowLinkAPI {
  getState: () => Promise<BurrowLinkSnapshot>;
  host: (request: { port: number }) => Promise<BurrowLinkSnapshot>;
  join: (request: { roomCode: string }) => Promise<BurrowLinkSnapshot>;
  stop: () => Promise<BurrowLinkSnapshot>;
  onState: (callback: (snapshot: BurrowLinkSnapshot) => void) => () => void;
}

export interface LanDiscoveryAPI {
  getState: () => Promise<LanDiscoverySnapshot>;
  start: (request?: { family?: 'udp4' | 'udp6' }) => Promise<LanDiscoverySnapshot>;
  stop: () => Promise<LanDiscoverySnapshot>;
  broadcast: (request: { motd: string; port: number }) => Promise<LanDiscoverySnapshot>;
  ping: (request: { host: string; port?: number }) => Promise<MinecraftServerStatusResult>;
  onState: (callback: (snapshot: LanDiscoverySnapshot) => void) => () => void;
  onDiscover: (callback: (event: LanDiscoverEvent) => void) => () => void;
}

export interface PortMappingAPI {
  getState: () => Promise<PortMappingSnapshot>;
  mapTcp: (request: { publicPort: number; privatePort: number }) => Promise<PortMappingSnapshot>;
  unmapTcp: (request: { publicPort: number }) => Promise<PortMappingSnapshot>;
  stop: () => Promise<PortMappingSnapshot>;
  onState: (callback: (snapshot: PortMappingSnapshot) => void) => () => void;
}

export interface NetworkAPI {
  tunnel: BurrowLinkAPI;
  lan: LanDiscoveryAPI;
  upnp: PortMappingAPI;
}
