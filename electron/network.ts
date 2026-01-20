// @ts-ignore
import Hyperswarm from 'hyperswarm';
// @ts-ignore
import b4a from 'b4a';
// @ts-ignore
import pump from 'pump';

import crypto from 'crypto';
import net from 'net';
import { EventEmitter } from 'events';
import { Duplex } from 'stream';

// Simple Muxer to handle multiple TCP streams over one P2P connection
// Header: [Length (2 bytes BE)][SessionID (2 bytes BE)][Type (1 byte)]
// Type: 0 = DATA, 1 = OPEN, 2 = CLOSE
const HEADER_SIZE = 5;
const CMD_DATA = 0;
const CMD_OPEN = 1;
const CMD_CLOSE = 2;

class MuxerStream extends Duplex {
    private muxer: Muxer;
    public sessionId: number;

    constructor(muxer: Muxer, sessionId: number) {
        super();
        this.muxer = muxer;
        this.sessionId = sessionId;
    }

    _write(chunk: Buffer, _encoding: string, callback: (err?: Error) => void) {
        try {
            this.muxer.send(this.sessionId, CMD_DATA, chunk);
            callback();
        } catch (err: any) {
            callback(err);
        }
    }

    _read(_size: number) {
        // Data is pushed via pushData called by Muxer
    }

    _destroy(err: Error | null, callback: (err: Error | null) => void) {
        if (!err) {
            this.muxer.send(this.sessionId, CMD_CLOSE);
        }
        this.muxer.removeStream(this.sessionId);
        callback(err);
    }

    public pushData(data: Buffer) {
        this.push(data);
    }
}

class Muxer extends EventEmitter {
    private conn: any;
    private buffer: Buffer;
    private processing: boolean = false;
    private streams: Map<number, MuxerStream> = new Map();

    constructor(conn: any) {
        super();
        this.conn = conn;
        this.buffer = b4a.alloc(0);

        // Handle incoming raw P2P data
        conn.on('data', (chunk: Buffer) => {
            this.buffer = b4a.concat([this.buffer, chunk]);
            this.process();
        });

        conn.on('close', () => {
            this.emit('close');
            // Destroy all streams
            for (const stream of this.streams.values()) {
                stream.destroy();
            }
            this.streams.clear();
        });

        conn.on('error', (err: any) => {
            this.emit('error', err);
            for (const stream of this.streams.values()) {
                stream.destroy(err);
            }
            this.streams.clear();
        });
    }

    private process() {
        if (this.processing) return;
        this.processing = true;

        while (this.buffer.length >= HEADER_SIZE) {
            // Read length (first 2 bytes)
            const length = this.buffer.readUInt16BE(0);

            // Check if we have the full packet
            if (this.buffer.length < length) {
                break; // Wait for more data
            }

            // Extract packet
            const packet = this.buffer.subarray(0, length);
            this.buffer = this.buffer.subarray(length);

            // Parse Header
            const sessionId = packet.readUInt16BE(2);
            const type = packet.readUInt8(4);
            const data = packet.subarray(HEADER_SIZE);

            // Handle Packet
            if (type === CMD_DATA) {
                const stream = this.streams.get(sessionId);
                if (stream) {
                    stream.pushData(data);
                }
            } else if (type === CMD_OPEN) {
                if (this.streams.has(sessionId)) {
                    // Stream already exists? Reset?
                    const stream = this.streams.get(sessionId)!;
                    stream.destroy();
                }
                const stream = new MuxerStream(this, sessionId);
                this.streams.set(sessionId, stream);
                this.emit('stream', stream);
            } else if (type === CMD_CLOSE) {
                const stream = this.streams.get(sessionId);
                if (stream) {
                    stream.destroy(); // Will remove from map
                }
            }
        }

        this.processing = false;
    }

    public send(sessionId: number, type: number, data?: Buffer) {
        const payloadLength = data ? data.length : 0;
        const totalLength = HEADER_SIZE + payloadLength;

        // Safety check for max packet size (uint16 = 65535)
        if (totalLength > 65535) {
            if (data && data.length > 60000) {
                const chunk1 = data.subarray(0, 60000);
                const chunk2 = data.subarray(60000);
                this.send(sessionId, type, chunk1);
                this.send(sessionId, type, chunk2);
                return;
            }
        }

        const header = b4a.alloc(HEADER_SIZE);
        header.writeUInt16BE(totalLength, 0);
        header.writeUInt16BE(sessionId, 2);
        header.writeUInt8(type, 4);

        if (data) {
            this.conn.write(b4a.concat([header, data]));
        } else {
            this.conn.write(header);
        }
    }

    public createStream(sessionId: number): MuxerStream {
        const stream = new MuxerStream(this, sessionId);
        this.streams.set(sessionId, stream);
        return stream;
    }

    public removeStream(sessionId: number) {
        this.streams.delete(sessionId);
    }
}

export class NetworkManager {
    private swarm: any;
    private server: net.Server | null = null;
    public activeCode: string | null = null;

    private _lanPort: number = 0;

    constructor() {
        this.swarm = new Hyperswarm();
    }

    // HOSTING
    public async host(lanPort: number, onLog: (msg: string) => void): Promise<string> {
        await this.stop(onLog);
        this._lanPort = lanPort;

        const topicBuffer = crypto.randomBytes(32);
        const topicHex = b4a.toString(topicBuffer, 'hex');

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
                    } else {
                        // onLog(`[Network] Stream ${stream.sessionId} finished.`);
                    }
                });
            });

            muxer.on('close', () => {
                onLog('[Network] Peer disconnected.');
            });
        });

        this.activeCode = topicHex;
        onLog(`[Network] Hosting started! Room Code: ${topicHex}`);
        return topicHex;
    }

    // JOINING
    public async join(code: string, onLog: (msg: string) => void): Promise<number> {
        await this.stop(onLog);

        const topicBuffer = b4a.from(code, 'hex');
        const discoveryKey = this.swarm.join(topicBuffer, { client: true, server: false });
        await discoveryKey.flushed();

        const server = net.createServer(async (socket) => {
            // 1. Get Peer Connection
            let conn = this.swarm.connections.values().next().value;

            // Retry logic
            if (!conn) {
                for (let i = 0; i < 10; i++) {
                    await new Promise(r => setTimeout(r, 500));
                    conn = this.swarm.connections.values().next().value;
                    if (conn) break;
                }
            }

            if (!conn) {
                onLog('[Network] No peers found. Is Host online?');
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

            // Initiate connection by sending Open command (stream creation does not auto-send open yet in my impl? 
            // wait, MuxerStream doesn't send OPEN in constructor.
            // But we need to tell Host to expect this.
            // My new Muxer logic: CMD_OPEN creates stream on receiver.
            // So we MUST send OPEN.
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
