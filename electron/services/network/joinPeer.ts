import type Hyperswarm from 'hyperswarm';
import pump from 'pump';
import type { Socket } from 'net';
import { Muxer } from './muxer';
import type { Connection } from './types';
import { DEFAULT_CONNECT_TIMEOUT_MS } from './types';

const muxers = new WeakMap<object, Muxer>();

export async function getOrWaitPeerConnection(params: {
  swarm: InstanceType<typeof Hyperswarm>;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<unknown> {
  const { swarm, timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS, signal } = params;

  const existingConn = swarm.connections.values().next().value;
  if (existingConn) return existingConn;

  return await new Promise<unknown>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      swarm.off('connection', onConnection);
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(timeout);
    };
    const onConnection = (conn: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(conn);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Connection attempt was stopped'));
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Connection timeout: No peer found after ${timeoutMs}ms`));
    }, timeoutMs);
    swarm.on('connection', onConnection);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export function ensureMuxerOnConnection(conn: unknown, onLog: (msg: string) => void) {
  if (!conn || typeof conn !== 'object') throw new Error('Invalid peer connection');
  let muxer = muxers.get(conn);
  if (!muxer) {
    muxer = new Muxer(conn as Connection);
    muxers.set(conn, muxer);
    onLog('[Network] Muxer initialized on existing P2P link.');
  }
  return muxer;
}

export function bridgeLocalSocketToMuxer(params: {
  socket: Socket;
  muxer: Muxer;
  onLog: (msg: string) => void;
}) {
  const { socket, muxer, onLog } = params;

  const stream = muxer.createStream();

  pump(socket, stream, socket, (_err?: Error) => {
    // Connection closed
  });

  onLog(`[Network] Opened stream session ${stream.sessionId}`);
}
