import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import pump from 'pump';
import crypto from 'crypto';
import net from 'net';
import { Muxer, MuxerStream } from './network/muxer';

const CMD_OPEN = 1;

// P2P tunnel manager used for Minecraft LAN sharing.
export class NetworkManager {
    private swarm: Hyperswarm;
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
            onLog(`[Network] Peer connected! Multiplexer ready.`);

            const muxer = new Muxer(conn);

            // Handle incoming streams from client (player joining).
            muxer.on('stream', (stream: MuxerStream) => {
                onLog(`[Network] Incoming connection Stream ${stream.sessionId}`);

                // Connect to local Minecraft LAN port.
                const socket = net.connect(this._lanPort, 'localhost');

                // Pump data: Stream (peer) -> Socket (Minecraft) -> Stream (peer).
                pump(stream, socket, stream, (err: Error | null) => {
                    if (err) {
                        // Silence stream errors; disconnects are expected.
                    }
                    socket.destroy();
                });
            });

            muxer.once('close', () => {
                onLog('[Network] Peer disconnected.');
            });
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
            // Wait for peer connection with a short timeout.
            const connectionPromise = new Promise<unknown>((resolve, reject) => {
                // Check if already connected.
                const existingConn = this.swarm.connections.values().next().value;
                if (existingConn) {
                    resolve(existingConn);
                    return;
                }

                // Wait for new connection event.
                const onConnection = (conn: unknown) => {
                    this.swarm.off('connection', onConnection);
                    clearTimeout(timeout);
                    resolve(conn);
                };

                this.swarm.on('connection', onConnection);

                const timeout = setTimeout(() => {
                    this.swarm.off('connection', onConnection);
                    reject(new Error('Connection timeout: No peer found after 5 seconds'));
                }, 5000);
            });

            let conn;
            try {
                conn = await connectionPromise;
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                onLog(`[Network] ${errorMessage}. Is Host online?`);
                socket.end();
                return;
            }

            // Setup muxer if not exists for this connection.
            const connWithMuxer = conn as { _muxer?: Muxer };
            let muxer = connWithMuxer._muxer;
            if (!muxer) {
                muxer = new Muxer(conn as { on: (event: string, listener: (chunk: Buffer) => void) => void; write: (data: Buffer) => void });
                connWithMuxer._muxer = muxer;
                onLog('[Network] Muxer initialized on existing P2P link.');
            }

            // Start new session for this local socket.
            const sessionId = Math.floor(Math.random() * 60000); // Random ID
            const stream = muxer.createStream(sessionId);

            // Initiate connection by sending Open command.
            muxer.send(sessionId, CMD_OPEN);

            pump(socket, stream, socket, (_err: Error | null) => {
                // Closed
            });
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

        // Destroy all P2P connections.
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
