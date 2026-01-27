import { NetworkManager } from './networkManager';
import { MinecraftLanDiscover, queryStatus, type Status } from '@xmcl/client';
import { createUpnpClient, type UpnpClient } from '@xmcl/nat-api';

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
  private upnp?: UpnpClient;

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
    // UPnP mappings are not automatically removed here; caller can unmap explicitly.
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
  public async upnpEnsureClient() {
    if (!this.upnp) {
      this.upnp = await createUpnpClient();
    }
    return this.upnp;
  }

  public async upnpMapTcp(publicPort: number, privatePort: number, description = 'FriendLauncher', ttlSeconds = 60 * 30) {
    const client = await this.upnpEnsureClient();
    await client.map({
      protocol: 'tcp',
      public: publicPort,
      private: privatePort,
      description,
      ttl: ttlSeconds,
    });
    const externalIp = await client.externalIp().catch(() => '');
    return { externalIp };
  }

  public async upnpUnmapTcp(publicPort: number) {
    const client = await this.upnpEnsureClient();
    return await client.unmap({ protocol: 'tcp', public: publicPort });
  }
}

