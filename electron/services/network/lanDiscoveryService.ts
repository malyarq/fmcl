import { MinecraftLanDiscover, queryStatus, type Status } from '@xmcl/client';
import type { LanDiscoverEvent, LanDiscoverySnapshot, MinecraftServerStatus, MinecraftServerStatusResult } from '../../../shared/contracts/network';
import { diagnostic, SerialQueue, StatePublisher, type StateListener } from './networkState';

type DiscoverListener = (event: LanDiscoverEvent) => void;

export class LanDiscoveryService {
  private readonly state = new StatePublisher<LanDiscoverySnapshot>({
    revision: 0, state: 'idle', family: null, discoveredCount: 0,
  });
  private readonly queue = new SerialQueue();
  private readonly listeners = new Set<DiscoverListener>();
  private discover?: MinecraftLanDiscover;
  private discoverListener?: (event: { motd: string; port: number; remote: { address: string } }) => void;
  private discovered = new Set<string>();

  public getState(): LanDiscoverySnapshot { return this.state.get(); }
  public subscribe(listener: StateListener<LanDiscoverySnapshot>): () => void { return this.state.subscribe(listener); }
  public onDiscover(listener: DiscoverListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  public start(family: 'udp4' | 'udp6' = 'udp4'): Promise<LanDiscoverySnapshot> {
    return this.queue.run(async () => {
      if (this.discover && this.state.get().state === 'active' && this.state.get().family === family) return this.state.get();
      await this.stopUnlocked();
      this.state.publish({ state: 'starting', family, discoveredCount: 0 });
      const discover = new MinecraftLanDiscover(family);
      this.discover = discover;
      const onDiscover = (event: { motd: string; port: number; remote: { address: string } }) => {
        if (this.discover !== discover) return;
        const value = { motd: event.motd.slice(0, 256), port: event.port, address: event.remote.address.slice(0, 64) };
        const key = `${value.address}:${value.port}`;
        this.discovered.add(key);
        const current = this.state.get();
        this.state.publish({ ...current, discoveredCount: this.discovered.size });
        for (const listener of this.listeners) listener(value);
      };
      this.discoverListener = onDiscover;
      discover.on('discover', onDiscover);
      try {
        await discover.bind();
        return this.state.publish({ state: 'active', family, discoveredCount: 0 });
      } catch (error) {
        discover.removeListener('discover', onDiscover);
        this.discover = undefined;
        this.discoverListener = undefined;
        await discover.destroy().catch(() => undefined);
        return this.state.publish({ state: 'failed', family, discoveredCount: 0, diagnostic: diagnostic('LAN_BIND_FAILED', 'LAN discovery could not start', error) });
      }
    });
  }

  public stop(): Promise<LanDiscoverySnapshot> { return this.queue.run(async () => await this.stopUnlocked()); }

  public broadcast(motd: string, port: number): Promise<LanDiscoverySnapshot> {
    return this.queue.run(async () => {
      if (!this.discover || this.state.get().state !== 'active') await this.startUnlocked('udp4');
      try {
        await this.discover!.broadcast({ motd, port });
        return this.state.get();
      } catch (error) {
        const current = this.state.get();
        return this.state.publish({ ...current, state: 'failed', diagnostic: diagnostic('LAN_BROADCAST_FAILED', 'LAN broadcast failed', error) });
      }
    });
  }

  public async ping(host: string, port = 25_565, timeoutMs = 2_500): Promise<MinecraftServerStatusResult> {
    try {
      const status = await queryStatus({ host, port }, { timeout: timeoutMs, retryTimes: 1 });
      return { status: 'ok', server: toStatusDto(status) };
    } catch (error) {
      return { status: 'failed', diagnostic: diagnostic('LAN_PING_FAILED', 'Minecraft server did not answer', error) };
    }
  }

  private async startUnlocked(family: 'udp4' | 'udp6'): Promise<void> {
    if (this.discover && this.state.get().state === 'active') return;
    this.state.publish({ state: 'starting', family, discoveredCount: 0 });
    const discover = new MinecraftLanDiscover(family);
    this.discover = discover;
    const onDiscover = (event: { motd: string; port: number; remote: { address: string } }) => {
      if (this.discover !== discover) return;
      const value = { motd: event.motd.slice(0, 256), port: event.port, address: event.remote.address.slice(0, 64) };
      this.discovered.add(`${value.address}:${value.port}`);
      const current = this.state.get();
      this.state.publish({ ...current, discoveredCount: this.discovered.size });
      for (const listener of this.listeners) listener(value);
    };
    this.discoverListener = onDiscover;
    discover.on('discover', onDiscover);
    try {
      await discover.bind();
      this.state.publish({ state: 'active', family, discoveredCount: 0 });
    } catch (error) {
      discover.removeListener('discover', onDiscover);
      if (this.discover === discover) this.discover = undefined;
      if (this.discoverListener === onDiscover) this.discoverListener = undefined;
      await discover.destroy().catch(() => undefined);
      throw error;
    }
  }

  private async stopUnlocked(): Promise<LanDiscoverySnapshot> {
    const discover = this.discover;
    const listener = this.discoverListener;
    if (!discover) {
      const current = this.state.get();
      return current.state === 'idle' ? current : this.state.publish({ state: 'idle', family: null, discoveredCount: 0 });
    }
    this.discover = undefined;
    this.discoverListener = undefined;
    this.discovered = new Set();
    this.state.publish({ ...this.state.get(), state: 'stopping', diagnostic: undefined });
    try {
      if (listener) discover.removeListener('discover', listener);
      await discover.destroy();
      return this.state.publish({ state: 'idle', family: null, discoveredCount: 0 });
    } catch (error) {
      return this.state.publish({ state: 'failed', family: null, discoveredCount: 0, diagnostic: diagnostic('LAN_CLEANUP_FAILED', 'LAN discovery cleanup was incomplete', error) });
    }
  }
}

function toStatusDto(status: Status): MinecraftServerStatus {
  return {
    description: typeof status.description === 'string' ? status.description.slice(0, 512) : JSON.stringify(status.description).slice(0, 512),
    versionName: status.version.name.slice(0, 128),
    protocol: status.version.protocol,
    onlinePlayers: status.players.online,
    maxPlayers: status.players.max,
    latencyMs: status.ping,
  };
}
