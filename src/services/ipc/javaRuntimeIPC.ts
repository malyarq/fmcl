import type { FriendLauncherApi, JavaRuntimeSelectRequest } from '@shared/contracts';
import { toIpcError } from './ipcError';

type JavaRuntimeApi = NonNullable<FriendLauncherApi['javaRuntime']>;

function api(): JavaRuntimeApi {
  const javaRuntime = typeof window !== 'undefined' ? window.api?.javaRuntime : undefined;
  if (!javaRuntime) throw new Error('[javaRuntimeIPC] Java runtime API is not available');
  return javaRuntime;
}

async function call<T>(method: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const ipcError = toIpcError({ namespace: 'javaRuntimeIPC', method }, error);
    console.error(ipcError);
    throw ipcError;
  }
}

/** Renderer client for opaque Java runtime discovery and selection. */
export const javaRuntimeIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.javaRuntime),
  scan: () => call('scan', () => api().scan()),
  select: (request: JavaRuntimeSelectRequest) => call('select', () => api().select(request)),
};

export type JavaRuntimeIPC = typeof javaRuntimeIPC;
