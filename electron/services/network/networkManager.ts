import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import crypto from 'crypto';
import net from 'net';
import type { Connection } from './types';
import { handleHostPeerConnection } from './hostPeer';
import { bridgeLocalSocketToMuxer, ensureMuxerOnConnection, getOrWaitPeerConnection } from './joinPeer';

// P2P tunnel manager used for Minecraft LAN sharing.
export class NetworkManager {
    private swarm: InstanceType<typeof Hyperswarm>;
    private server: net.Server | null = null;
    public activeCode: string | null = null;

    private _lanPort: number = 0;

    constructor() {
        this.swarm = new Hyperswarm();
    }

    /**
     * Start Hosting a LAN world.
     * @param lanPort The port Minecraft is listening on (e.g., 25565 or random).
     * @param onLog Logger callback.
     * @returns The generated Room Code.
     */
    public async host(lanPort: number, onLog: (msg: string) => void): Promise<string> {
        await this.stop(onLog);
        this._lanPort = lanPort;

        const topicBuffer = crypto.randomBytes(32);
        const topicHex = b4a.toString(topicBuffer, 'hex');

        // Clean up any existing connection listeners.
        this.swarm.removeAllListeners('connection');

        // Host acts as server for incoming peers.
        const discoveryKey = this.swarm.join(topicBuffer, { server: true, client: false });
        await discoveryKey.flushed();

        this.swarm.on('connection', (conn: unknown) => {
            handleHostPeerConnection({ conn: conn as Connection, lanPort: this._lanPort, onLog });
        });

        this.activeCode = topicHex;
        onLog(`[Network] Hosting started! Room Code: ${topicHex}`);
        return topicHex;
    }

    /**
     * Join a hosted Room Code.
     * @param code The Room Code from host.
     * @param onLog Logger callback.
     * @returns The local port to connect Minecraft to (localhost:PORT).
     */
    public async join(code: string, onLog: (msg: string) => void): Promise<number> {
        await this.stop(onLog);

        const topicBuffer = b4a.from(code, 'hex');
        const discoveryKey = this.swarm.join(topicBuffer, { client: true, server: false });
        await discoveryKey.flushed();

        const server = net.createServer(async (socket) => {
            let conn: unknown;
            try {
                conn = await getOrWaitPeerConnection({ swarm: this.swarm });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                onLog(`[Network] ${errorMessage}. Is Host online?`);
                socket.end();
                return;
            }

            const muxer = ensureMuxerOnConnection(conn, onLog);
            bridgeLocalSocketToMuxer({ socket, muxer, onLog });
        });

        return new Promise((resolve) => {
            server.listen(0, '127.0.0.1', () => {
                const addr = server.address() as net.AddressInfo;
                this.server = server;
                this.activeCode = code;
                onLog(`[Network] Tunnel established. Connect to: localhost:${addr.port}`);
                resolve(addr.port);
            });
        });
    }

    public async stop(onLog: (msg: string) => void) {
        if (this.activeCode) {
            onLog('[Network] Stopping session...');
            this.swarm.leave(b4a.from(this.activeCode, 'hex'));
        }

        for (const conn of this.swarm.connections) {
            if (conn && typeof conn === 'object' && 'destroy' in conn && typeof conn.destroy === 'function') {
                conn.destroy();
            }
        }

        if (this.server) {
            this.server.close();
            this.server = null;
        }

        this.activeCode = null;
    }
}
