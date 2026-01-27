import type Hyperswarm from 'hyperswarm';
import pump from 'pump';
import type { Socket } from 'net';
import { Muxer } from './muxer';
import type { Connection } from './types';
import { CMD_OPEN, DEFAULT_CONNECT_TIMEOUT_MS } from './types';

export async function getOrWaitPeerConnection(params: {
  swarm: InstanceType<typeof Hyperswarm>;
  timeoutMs?: number;
}): Promise<unknown> {
  const { swarm, timeoutMs = DEFAULT_CONNECT_TIMEOUT_MS } = params;

  const existingConn = swarm.connections.values().next().value;
  if (existingConn) return existingConn;

  return await new Promise<unknown>((resolve, reject) => {
    const onConnection = (conn: unknown) => {
      swarm.off('connection', onConnection);
      clearTimeout(timeout);
      resolve(conn);
    };

    swarm.on('connection', onConnection);

    const timeout = setTimeout(() => {
      swarm.off('connection', onConnection);
      reject(new Error(`Connection timeout: No peer found after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

export function ensureMuxerOnConnection(conn: unknown, onLog: (msg: string) => void) {
  const connWithMuxer = conn as { _muxer?: Muxer };
  let muxer = connWithMuxer._muxer;
  if (!muxer) {
    muxer = new Muxer(conn as Connection);
    connWithMuxer._muxer = muxer;
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

  const sessionId = Math.floor(Math.random() * 60000);
  const stream = muxer.createStream(sessionId);
  muxer.send(sessionId, CMD_OPEN);

  pump(socket, stream, socket, (_err?: Error) => {
    // Connection closed
  });

  onLog(`[Network] Opened stream session ${sessionId}`);
}

