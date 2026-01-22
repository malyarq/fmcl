import Hyperswarm from 'hyperswarm';
import b4a from 'b4a';
import pump from 'pump';
import crypto from 'crypto';
import net from 'net';
import { Muxer, MuxerStream } from './network/muxer';

const CMD_OPEN = 1;

export class NetworkManager {
    private swarm: any;
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

        // Clean up any existing connection listeners
        this.swarm.removeAllListeners('connection');

        // Host acts as Server
        const discoveryKey = this.swarm.join(topicBuffer, { server: true, client: false });
        await discoveryKey.flushed();

        this.swarm.on('connection', (conn: any) => {
            onLog(`[Network] Peer connected! Multiplexer ready.`);

            const muxer = new Muxer(conn);

            // Handle incoming streams from Client (Player joining)
            muxer.on('stream', (stream: MuxerStream) => {
                onLog(`[Network] Incoming connection Stream ${stream.sessionId}`);

                // Connect to local Minecraft LAN port
                const socket = net.connect(this._lanPort, 'localhost');

                // Pump data: Stream (from Peer) -> Socket (Minecraft) -> Stream (to Peer)
                pump(stream, socket, stream, (err: any) => {
                    if (err) {
                        // onLog(`[Network] Stream ${stream.sessionId} closed with error: ${err.message}`);
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
            // 1. Wait for Peer Connection with timeout using event-based approach
            const connectionPromise = new Promise<any>((resolve, reject) => {
                // Check if already connected
                const existingConn = this.swarm.connections.values().next().value;
                if (existingConn) {
                    resolve(existingConn);
                    return;
                }

                // Wait for new connection event
                const onConnection = (conn: any) => {
                    this.swarm.off('connection', onConnection);
                    clearTimeout(timeout);
                    resolve(conn);
                };

                this.swarm.on('connection', onConnection);

                // Set timeout
                const timeout = setTimeout(() => {
                    this.swarm.off('connection', onConnection);
                    reject(new Error('Connection timeout: No peer found after 5 seconds'));
                }, 5000);
            });

            let conn;
            try {
                conn = await connectionPromise;
            } catch (err: any) {
                onLog(`[Network] ${err.message}. Is Host online?`);
                socket.end();
                return;
            }

            // 2. Setup Muxer if not exists for this connection
            let muxer = (conn as any)._muxer;
            if (!muxer) {
                muxer = new Muxer(conn);
                (conn as any)._muxer = muxer;
                onLog('[Network] Muxer initialized on existing P2P link.');
            }

            // 3. Start New Session
            const sessionId = Math.floor(Math.random() * 60000); // Random ID
            const stream = muxer.createStream(sessionId);

            // Initiate connection by sending Open command
            muxer.send(sessionId, CMD_OPEN);

            // 4. Pump it
            pump(socket, stream, socket, (_err: any) => {
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

        // Destroy all P2P connections
        for (const conn of this.swarm.connections) {
            conn.destroy();
        }

        if (this.server) {
            this.server.close();
            this.server = null;
        }

        this.activeCode = null;
    }
}
