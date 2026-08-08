import crypto from 'node:crypto';
import net from 'node:net';
import Hyperswarm from 'hyperswarm';
import type { BurrowLinkSnapshot } from '../../../shared/contracts/network';
import { handleHostPeerConnection } from './hostPeer';
import { bridgeLocalSocketToMuxer, ensureMuxerOnConnection, getOrWaitPeerConnection } from './joinPeer';
import { diagnostic, SerialQueue, StatePublisher, type StateListener } from './networkState';
import type { Connection } from './types';

type Swarm = InstanceType<typeof Hyperswarm>;
type Discovery = ReturnType<Swarm['join']>;

type TunnelResources = {
  swarm: Swarm;
  discovery?: Discovery;
  server?: net.Server;
  sockets: Set<net.Socket>;
  abortController: AbortController;
  peerCount: number;
};

export type BurrowLinkServiceOptions = {
  createSwarm?: () => Swarm;
  createServer?: typeof net.createServer;
  randomBytes?: typeof crypto.randomBytes;
  onLog?: (message: string) => void;
};

const INITIAL_STATE: BurrowLinkSnapshot = {
  revision: 0,
  state: 'idle',
  role: null,
  peerCount: 0,
};

export class BurrowLinkService {
  private readonly state = new StatePublisher<BurrowLinkSnapshot>(INITIAL_STATE);
  private readonly queue = new SerialQueue();
  private readonly createSwarm: () => Swarm;
  private readonly createServer: typeof net.createServer;
  private readonly randomBytes: typeof crypto.randomBytes;
  private readonly onLog: (message: string) => void;
  private resources?: TunnelResources;

  constructor(options: BurrowLinkServiceOptions = {}) {
    this.createSwarm = options.createSwarm ?? (() => new Hyperswarm());
    this.createServer = options.createServer ?? net.createServer;
    this.randomBytes = options.randomBytes ?? crypto.randomBytes;
    this.onLog = options.onLog ?? (() => undefined);
  }

  public getState(): BurrowLinkSnapshot { return this.state.get(); }
  public subscribe(listener: StateListener<BurrowLinkSnapshot>): () => void { return this.state.subscribe(listener); }

  public host(port: number): Promise<BurrowLinkSnapshot> {
    return this.queue.run(async () => {
      await this.stopUnlocked();
      this.state.publish({ state: 'starting', role: 'host', peerCount: 0 });
      const resources = this.createResources();
      try {
        const topic = this.randomBytes(32);
        const roomCode = topic.toString('hex');
        resources.swarm.on('connection', (rawConnection: unknown) => {
          const connection = rawConnection as Connection;
          this.publishPeerCount(resources, 1);
          connection.on('close', () => this.publishPeerCount(resources, -1));
          try { handleHostPeerConnection({ connection, lanPort: port, onLog: this.onLog }); }
          catch { connection.destroy(); }
        });
        resources.discovery = resources.swarm.join(topic, { server: true, client: false });
        await resources.discovery.flushed();
        this.onLog('[Network] Burrow Link host is active.');
        return this.state.publish({ state: 'active', role: 'host', roomCode, peerCount: resources.peerCount });
      } catch (error) {
        await this.cleanup(resources);
        return this.state.publish({
          state: 'failed', role: 'host', peerCount: 0,
          diagnostic: diagnostic('TUNNEL_DISCOVERY_FAILED', 'Burrow Link discovery could not start', error),
        });
      }
    });
  }

  public join(roomCode: string): Promise<BurrowLinkSnapshot> {
    return this.queue.run(async () => {
      await this.stopUnlocked();
      if (!/^[0-9a-f]{64}$/.test(roomCode)) {
        return this.state.publish({
          state: 'failed', role: 'join', peerCount: 0,
          diagnostic: diagnostic('INVALID_REQUEST', 'Room code must contain exactly 64 lowercase hexadecimal characters'),
        });
      }
      this.state.publish({ state: 'starting', role: 'join', peerCount: 0 });
      const resources = this.createResources();
      try {
        const topic = Buffer.from(roomCode, 'hex');
        resources.swarm.on('connection', (rawConnection: unknown) => {
          const connection = rawConnection as Connection;
          this.publishPeerCount(resources, 1);
          connection.on('close', () => this.publishPeerCount(resources, -1));
        });
        resources.discovery = resources.swarm.join(topic, { client: true, server: false });
        await resources.discovery.flushed();

        const server = this.createServer(async (socket) => {
          resources.sockets.add(socket);
          socket.once('close', () => resources.sockets.delete(socket));
          try {
            const connection = await getOrWaitPeerConnection({ swarm: resources.swarm, signal: resources.abortController.signal });
            bridgeLocalSocketToMuxer({ socket, muxer: ensureMuxerOnConnection(connection, this.onLog), onLog: this.onLog });
          } catch {
            socket.destroy();
          }
        });
        resources.server = server;
        const localPort = await listen(server);
        this.onLog(`[Network] Burrow Link join endpoint is active on localhost:${localPort}.`);
        return this.state.publish({ state: 'active', role: 'join', roomCode, localPort, peerCount: resources.peerCount });
      } catch (error) {
        await this.cleanup(resources);
        return this.state.publish({
          state: 'failed', role: 'join', peerCount: 0,
          diagnostic: diagnostic('TUNNEL_LISTEN_FAILED', 'Burrow Link local endpoint could not start', error),
        });
      }
    });
  }

  public stop(): Promise<BurrowLinkSnapshot> {
    return this.queue.run(async () => await this.stopUnlocked());
  }

  private createResources(): TunnelResources {
    const resources = { swarm: this.createSwarm(), sockets: new Set<net.Socket>(), abortController: new AbortController(), peerCount: 0 };
    this.resources = resources;
    return resources;
  }

  private publishPeerCount(resources: TunnelResources, delta: number): void {
    resources.peerCount = Math.max(0, resources.peerCount + delta);
    if (this.resources !== resources || this.state.get().state !== 'active') return;
    const current = this.state.get();
    this.state.publish({ ...current, peerCount: resources.peerCount });
  }

  private async stopUnlocked(): Promise<BurrowLinkSnapshot> {
    const resources = this.resources;
    if (!resources) {
      const current = this.state.get();
      return current.state === 'idle' ? current : this.state.publish({ state: 'idle', role: null, peerCount: 0 });
    }
    const current = this.state.get();
    this.state.publish({ ...current, state: 'stopping', diagnostic: undefined });
    const errors = await this.cleanup(resources);
    return errors.length
      ? this.state.publish({ state: 'failed', role: null, peerCount: 0, diagnostic: diagnostic('TUNNEL_CLEANUP_FAILED', 'Burrow Link cleanup was incomplete') })
      : this.state.publish({ state: 'idle', role: null, peerCount: 0 });
  }

  private async cleanup(resources: TunnelResources): Promise<unknown[]> {
    if (this.resources === resources) this.resources = undefined;
    resources.abortController.abort();
    for (const socket of resources.sockets) socket.destroy();
    resources.sockets.clear();
    const results = await Promise.allSettled([
      resources.server ? closeServer(resources.server) : Promise.resolve(),
      resources.discovery?.destroy() ?? Promise.resolve(),
      resources.swarm.destroy(),
    ]);
    return results.filter((result): result is PromiseRejectedResult => result.status === 'rejected').map((result) => result.reason);
  }
}

async function listen(server: net.Server): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Local tunnel address is unavailable'));
      resolve(address.port);
    });
  });
}

async function closeServer(server: net.Server): Promise<void> {
  (server as net.Server & { closeAllConnections?: () => void }).closeAllConnections?.();
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
