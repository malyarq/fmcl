import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { Muxer } from '../muxer';

class FakeConnection extends EventEmitter {
  public readonly writes: Buffer[] = [];
  public readonly destroy = vi.fn();
  public write(data: Buffer): void { this.writes.push(Buffer.from(data)); }
}

function frame(sessionId: number, command: number, data = Buffer.alloc(0)): Buffer {
  const result = Buffer.alloc(5 + data.length);
  result.writeUInt16BE(result.length, 0);
  result.writeUInt16BE(sessionId, 2);
  result.writeUInt8(command, 4);
  data.copy(result, 5);
  return result;
}

describe('Muxer', () => {
  it('parses fragmented and coalesced frames', async () => {
    const connection = new FakeConnection();
    const muxer = new Muxer(connection);
    const streams: Array<{ sessionId: number; data: Buffer[] }> = [];
    muxer.on('stream', (stream) => {
      const entry = { sessionId: stream.sessionId, data: [] as Buffer[] };
      stream.on('data', (data: Buffer) => entry.data.push(data));
      streams.push(entry);
    });
    const bytes = Buffer.concat([frame(7, 1), frame(7, 0, Buffer.from('hello'))]);
    connection.emit('data', bytes.subarray(0, 3));
    connection.emit('data', bytes.subarray(3));
    await new Promise((resolve) => setImmediate(resolve));
    expect(streams).toHaveLength(1);
    expect(streams[0]).toMatchObject({ sessionId: 7 });
    expect(Buffer.concat(streams[0].data).toString()).toBe('hello');
  });

  it.each([
    ['short frame', Buffer.from([0, 0, 0, 1, 0])],
    ['zero session', frame(0, 1)],
    ['unknown command', frame(1, 9)],
    ['control payload', frame(1, 1, Buffer.from('x'))],
    ['data before open', frame(1, 0, Buffer.from('x'))],
    ['close before open', frame(1, 2)],
  ])('contains %s as a protocol violation', (_label, bytes) => {
    const connection = new FakeConnection();
    const onError = vi.fn();
    new Muxer(connection, onError);
    connection.emit('data', bytes);
    expect(onError).toHaveBeenCalledOnce();
    expect(connection.destroy).toHaveBeenCalledOnce();
  });

  it('does not echo a remote close', () => {
    const connection = new FakeConnection();
    new Muxer(connection);
    connection.emit('data', frame(3, 1));
    connection.writes.length = 0;
    connection.emit('data', frame(3, 2));
    expect(connection.writes).toHaveLength(0);
  });

  it('allocates distinct non-zero local sessions', () => {
    const connection = new FakeConnection();
    const muxer = new Muxer(connection);
    const first = muxer.createStream();
    const second = muxer.createStream();
    expect(first.sessionId).toBeGreaterThan(0);
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('closes without an unhandled error event', () => {
    const connection = new FakeConnection();
    const muxer = new Muxer(connection);
    const stream = muxer.createStream();
    expect(() => connection.emit('error', new Error('peer failed'))).not.toThrow();
    expect(stream.destroyed).toBe(true);
  });
});
