import net from 'net';
import pump from 'pump';
import { Muxer, type MuxerStream } from './muxer';
import type { Connection } from './types';

export function handleHostPeerConnection(params: {
  conn: Connection;
  lanPort: number;
  onLog: (msg: string) => void;
}) {
  const { conn, lanPort, onLog } = params;

  onLog('[Network] Peer connected! Multiplexer ready.');
  const muxer = new Muxer(conn);

  // Handle incoming streams from client (player joining).
  muxer.on('stream', (stream: MuxerStream) => {
    onLog(`[Network] Incoming connection Stream ${stream.sessionId}`);

    const socket = net.connect(lanPort, 'localhost');
    pump(stream, socket, stream, (_err?: Error) => {
      // Silence stream errors; disconnects are expected
      socket.destroy();
    });
  });

  muxer.once('close', () => {
    onLog('[Network] Peer disconnected.');
  });
}

