export interface Connection {
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  write(data: Buffer): void;
  destroy(error?: Error): void;
}
export const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
