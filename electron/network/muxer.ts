import { EventEmitter } from 'events';
import { Duplex } from 'stream';
import b4a from 'b4a';

// Packet header: [Length (2 bytes BE)][SessionID (2 bytes BE)][Type (1 byte)].
const HEADER_SIZE = 5;
const CMD_DATA = 0;
const CMD_OPEN = 1;
const CMD_CLOSE = 2;

/**
 * A Duplex stream wrapping a specific session ID within the multiplexed connection.
 */
export class MuxerStream extends Duplex {
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
        } catch (err) {
            callback(err instanceof Error ? err : new Error(String(err)));
        }
    }

    _read(_size: number) {
        // Data is pushed via pushData when packets arrive
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

/**
 * Multiplexer Class
 * Handles splitting a single P2P connection into multiple logical streams (sessions).
 * Used to support multiple player connections (though rarely used in simple LAN) 
 * or just to provide a clean Stream interface over the raw Hyperswarm connection.
 */
interface Connection {
    on(event: 'data', listener: (chunk: Buffer) => void): void;
    on(event: 'close', listener: () => void): void;
    on(event: 'error', listener: (err: Error) => void): void;
    write(data: Buffer): void;
}

export class Muxer extends EventEmitter {
    private conn: Connection;
    private buffer: Buffer;
    private processing: boolean = false;
    private streams: Map<number, MuxerStream> = new Map();

    constructor(conn: Connection) {
        super();
        this.conn = conn;
        this.buffer = b4a.alloc(0);

        conn.on('data', (chunk: Buffer) => {
            this.buffer = b4a.concat([this.buffer, chunk]);
            this.process();
        });

        conn.on('close', () => {
            this.emit('close');
            for (const stream of this.streams.values()) {
                stream.destroy();
            }
            this.streams.clear();
        });

        conn.on('error', (err: Error) => {
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
            const length = this.buffer.readUInt16BE(0);

            if (this.buffer.length < length) {
                break;
            }

            const packet = this.buffer.subarray(0, length);
            this.buffer = this.buffer.subarray(length);

            const sessionId = packet.readUInt16BE(2);
            const type = packet.readUInt8(4);
            const data = packet.subarray(HEADER_SIZE);

            if (type === CMD_DATA) {
                const stream = this.streams.get(sessionId);
                if (stream) {
                    stream.pushData(data);
                }
            } else if (type === CMD_OPEN) {
                if (this.streams.has(sessionId)) {
                    const stream = this.streams.get(sessionId)!;
                    stream.destroy();
                }
                const stream = new MuxerStream(this, sessionId);
                this.streams.set(sessionId, stream);
                this.emit('stream', stream);
            } else if (type === CMD_CLOSE) {
                const stream = this.streams.get(sessionId);
                if (stream) {
                stream.destroy();
                }
            }
        }

        this.processing = false;
    }

    public send(sessionId: number, type: number, data?: Buffer) {
        const payloadLength = data ? data.length : 0;
        const totalLength = HEADER_SIZE + payloadLength;

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
