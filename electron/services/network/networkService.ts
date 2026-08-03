import { NetworkManager } from './networkManager';
import { MinecraftLanDiscover, queryStatus, type Status } from '@xmcl/client';
import { upnpNat, type Gateway, type UPnPNAT } from '@achingbrain/nat-port-mapper';

export type NetworkMode = 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';

/**
 * Network service boundary.
 *
 * Step-6 note:
 * - We keep Hyperswarm-based `NetworkManager` intact (requirement).
 * - We add XMCL LAN discovery/ping and optional UPnP in parallel.
 */
export class NetworkService {
  public readonly hyperswarm: NetworkManager;
  private mode: NetworkMode = 'hyperswarm';

  private lan?: MinecraftLanDiscover;
  private upnp?: UPnPNAT;
  private upnpGateway?: Gateway;
  private readonly upnpMappings = new Map<number, number>();

  constructor(manager?: NetworkManager) {
    this.hyperswarm = manager ?? new NetworkManager();
  }

  public getMode(): NetworkMode {
    return this.mode;
  }

  public setMode(mode: NetworkMode) {
    this.mode = mode;
  }

  // --- Hyperswarm tunnel API (existing UI) ---
  public async hostTunnel(lanPort: number, onLog: (msg: string) => void): Promise<string> {
    if (this.mode !== 'hyperswarm') {
      throw new Error(`Network mode ${this.mode} does not support room-code tunnels. Switch to hyperswarm.`);
    }
    return await this.hyperswarm.host(lanPort, onLog);
  }

  public async joinTunnel(code: string, onLog: (msg: string) => void): Promise<number> {
    if (this.mode !== 'hyperswarm') {
      throw new Error(`Network mode ${this.mode} does not support room-code tunnels. Switch to hyperswarm.`);
    }
    return await this.hyperswarm.join(code, onLog);
  }

  public async stop(onLog: (msg: string) => void) {
    // Always stop hyperswarm session if any.
    await this.hyperswarm.stop(onLog);
    // Also stop LAN discovery broadcast/listener.
    await this.lanStop().catch(() => undefined);
    if (this.upnpGateway) {
      await this.upnpGateway.stop().catch(() => undefined);
      this.upnpGateway = undefined;
      this.upnpMappings.clear();
    }
  }

  // --- XMCL ping ---
  public async ping(host: string, port = 25565, timeoutMs = 2500): Promise<Status> {
    return await queryStatus({ host, port }, { timeout: timeoutMs, retryTimes: 1 });
  }

  // --- XMCL LAN discovery ---
  public async lanStart(type: 'udp4' | 'udp6' = 'udp4') {
    if (this.lan && this.lan.isReady) return;
    this.lan = new MinecraftLanDiscover(type);
    await this.lan.bind();
  }

  public async lanStop() {
    if (!this.lan) return;
    const lan = this.lan;
    this.lan = undefined;
    await lan.destroy();
  }

  public onLanDiscover(listener: (event: { motd: string; port: number; address: string }) => void) {
    if (!this.lan) throw new Error('LAN discover is not started');
    const handler = (e: { motd: string; port: number; remote: { address: string } }) => {
      listener({ motd: e.motd, port: e.port, address: e.remote.address });
    };
    this.lan.on('discover', handler);
    return () => {
      this.lan?.removeListener('discover', handler);
    };
  }

  public async lanBroadcast(motd: string, port: number) {
    if (!this.lan) {
      await this.lanStart('udp4');
    }
    if (!this.lan) throw new Error('LAN discover init failed');
    await this.lan.broadcast({ motd, port });
  }

  // --- Optional UPnP ---
  private async upnpEnsureGateway(): Promise<Gateway> {
    if (this.upnpGateway) {
      return this.upnpGateway;
    }

    this.upnp ??= upnpNat({ autoRefresh: true });
    const signal = AbortSignal.timeout(8_000);
    for await (const gateway of this.upnp.findGateways({ signal })) {
      this.upnpGateway = gateway;
      return gateway;
    }

    throw new Error('No UPnP gateway was found on the local network');
  }

  public async upnpMapTcp(publicPort: number, privatePort: number, description = 'FriendLauncher', ttlSeconds = 60 * 30) {
    const gateway = await this.upnpEnsureGateway();
    let externalIp = '';

    for await (const mapping of gateway.mapAll(privatePort, {
      protocol: 'TCP',
      externalPort: publicPort,
      description,
      ttl: ttlSeconds * 1_000,
    })) {
      externalIp = mapping.externalHost;
      this.upnpMappings.set(publicPort, privatePort);
      break;
    }

    if (!this.upnpMappings.has(publicPort)) {
      throw new Error(`UPnP gateway could not map TCP port ${publicPort}`);
    }

    return { externalIp };
  }

  public async upnpUnmapTcp(publicPort: number) {
    const privatePort = this.upnpMappings.get(publicPort);
    if (privatePort === undefined || !this.upnpGateway) {
      return false;
    }

    await this.upnpGateway.unmap(privatePort);
    this.upnpMappings.delete(publicPort);
    return true;
  }
}
