import { EventEmitter } from 'node:events';
import { Duplex } from 'node:stream';

const HEADER_SIZE = 5;
const MAX_FRAME_SIZE = 65_535;
const MAX_PAYLOAD_SIZE = MAX_FRAME_SIZE - HEADER_SIZE;
const MAX_BUFFER_SIZE = MAX_FRAME_SIZE * 2;
const CMD_DATA = 0;
const CMD_OPEN = 1;
const CMD_CLOSE = 2;
const KNOWN_COMMANDS = new Set([CMD_DATA, CMD_OPEN, CMD_CLOSE]);

export interface MuxConnection {
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  write(data: Buffer): void;
  destroy?(error?: Error): void;
}

export class MuxerStream extends Duplex {
  private remoteClosing = false;

  constructor(private readonly muxer: Muxer, public readonly sessionId: number) {
    super();
  }

  public _write(chunk: Buffer, _encoding: string, callback: (error?: Error | null) => void): void {
    try {
      this.muxer.send(this.sessionId, CMD_DATA, chunk);
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public _read(): void {}

  public _destroy(error: Error | null, callback: (error: Error | null) => void): void {
    if (!this.remoteClosing && !error) this.muxer.sendClose(this.sessionId);
    this.muxer.removeStream(this.sessionId);
    callback(error);
  }

  public pushData(data: Buffer): void {
    this.push(data);
  }

  public closeFromRemote(error?: Error): void {
    this.remoteClosing = true;
    this.destroy(error);
  }
}

export class Muxer extends EventEmitter {
  private buffer = Buffer.alloc(0);
  private readonly streams = new Map<number, MuxerStream>();
  private nextSessionId = 1;
  private closed = false;

  constructor(
    private readonly connection: MuxConnection,
    private readonly onProtocolError: (error: Error) => void = () => undefined,
  ) {
    super();
    connection.on('data', (chunk) => this.receive(chunk));
    connection.on('close', () => this.closeAll());
    connection.on('error', (error) => this.closeAll(error));
  }

  public createStream(): MuxerStream {
    const sessionId = this.allocateSessionId();
    const stream = new MuxerStream(this, sessionId);
    this.streams.set(sessionId, stream);
    this.send(sessionId, CMD_OPEN);
    return stream;
  }

  public send(sessionId: number, command: number, data?: Buffer): void {
    if (this.closed) throw new Error('Tunnel connection is closed');
    if (!KNOWN_COMMANDS.has(command)) throw new Error('Unknown tunnel command');
    const payload = data ?? Buffer.alloc(0);
    if (command !== CMD_DATA && payload.length > 0) throw new Error('Control frame payload is not allowed');

    if (payload.length > MAX_PAYLOAD_SIZE) {
      for (let offset = 0; offset < payload.length; offset += MAX_PAYLOAD_SIZE) {
        this.send(sessionId, command, payload.subarray(offset, offset + MAX_PAYLOAD_SIZE));
      }
      return;
    }

    const header = Buffer.alloc(HEADER_SIZE);
    header.writeUInt16BE(HEADER_SIZE + payload.length, 0);
    header.writeUInt16BE(sessionId, 2);
    header.writeUInt8(command, 4);
    this.connection.write(payload.length ? Buffer.concat([header, payload]) : header);
  }

  public sendClose(sessionId: number): void {
    if (!this.closed && this.streams.has(sessionId)) this.send(sessionId, CMD_CLOSE);
  }

  public removeStream(sessionId: number): void {
    this.streams.delete(sessionId);
  }

  public get activeStreamCount(): number {
    return this.streams.size;
  }

  private receive(chunk: Buffer): void {
    if (this.closed || chunk.length === 0) return;
    if (this.buffer.length + chunk.length > MAX_BUFFER_SIZE) {
      this.protocolViolation('Tunnel frame buffer limit exceeded');
      return;
    }
    this.buffer = Buffer.concat([this.buffer, chunk]);

    while (!this.closed && this.buffer.length >= HEADER_SIZE) {
      const length = this.buffer.readUInt16BE(0);
      if (length < HEADER_SIZE) {
        this.protocolViolation('Tunnel frame length is smaller than its header');
        return;
      }
      if (this.buffer.length < length) return;

      const frame = this.buffer.subarray(0, length);
      this.buffer = this.buffer.subarray(length);
      const sessionId = frame.readUInt16BE(2);
      const command = frame.readUInt8(4);
      const payload = frame.subarray(HEADER_SIZE);

      if (sessionId === 0 || !KNOWN_COMMANDS.has(command)) {
        this.protocolViolation('Tunnel frame contains an invalid session or command');
        return;
      }
      if (command !== CMD_DATA && payload.length > 0) {
        this.protocolViolation('Tunnel control frame contains a payload');
        return;
      }

      const existing = this.streams.get(sessionId);
      if (command === CMD_OPEN) {
        if (existing) {
          this.protocolViolation('Tunnel session was opened twice');
          return;
        }
        const stream = new MuxerStream(this, sessionId);
        this.streams.set(sessionId, stream);
        this.emit('stream', stream);
      } else if (command === CMD_DATA) {
        if (!existing) {
          this.protocolViolation('Tunnel data targets an unknown session');
          return;
        }
        existing.pushData(payload);
      } else {
        if (!existing) {
          this.protocolViolation('Tunnel close targets an unknown session');
          return;
        }
        existing.closeFromRemote();
      }
    }
  }

  private allocateSessionId(): number {
    for (let attempt = 0; attempt < 65_535; attempt += 1) {
      const candidate = this.nextSessionId;
      this.nextSessionId = candidate === 65_535 ? 1 : candidate + 1;
      if (!this.streams.has(candidate)) return candidate;
    }
    throw new Error('Tunnel session limit reached');
  }

  private protocolViolation(message: string): void {
    const error = new Error(message);
    this.onProtocolError(error);
    this.connection.destroy?.(error);
    this.closeAll(error);
  }

  private closeAll(_error?: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.buffer = Buffer.alloc(0);
    // The connection owns the failure diagnostic. Destroying child streams
    // without re-emitting that error avoids an unhandled EventEmitter error in
    // consumers that treat disconnects as normal lifecycle events.
    for (const stream of [...this.streams.values()]) stream.closeFromRemote();
    this.streams.clear();
    this.emit('close');
  }
}
