import type { AllowedIpcChannel } from './ipcChannels';

export interface IpcRendererAPI {
  on: (channel: AllowedIpcChannel, listener: (event: unknown, ...args: unknown[]) => void) => unknown;
  off: (channel: AllowedIpcChannel, listener: (...args: unknown[]) => void) => unknown;
  send: (channel: AllowedIpcChannel, ...args: unknown[]) => void;
  invoke: <T = unknown>(channel: AllowedIpcChannel, ...args: unknown[]) => Promise<T>;
}

