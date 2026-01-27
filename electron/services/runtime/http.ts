import os from 'node:os';
import { Agent, interceptors, type Dispatcher } from 'undici';
import { DEFAULT_BODY_TIMEOUT, DEFAULT_CONNECT_TIMEOUT, DEFAULT_HEADERS_TIMEOUT } from '@shared/constants';

/**
 * Runtime-level HTTP primitives used by installer / download flows.
 * Kept separate from LauncherManager to keep `electron/launcher.ts` orchestration-only.
 */
export function createDispatcher(maxSockets: number, retryCount = 5, maxRedirections = 5): Dispatcher {
  return new Agent({
    connections: maxSockets,
    connectTimeout: DEFAULT_CONNECT_TIMEOUT,
    headersTimeout: DEFAULT_HEADERS_TIMEOUT,
    bodyTimeout: DEFAULT_BODY_TIMEOUT,
  }).compose(interceptors.retry({ maxRetries: retryCount }), interceptors.redirect({ maxRedirections }));
}

export function resolveDownloadConcurrency(autoThreads: boolean | undefined, downloadThreads: number | undefined) {
  if (autoThreads) {
    return Math.max(os.cpus().length * 2, 6);
  }
  return Math.max(1, downloadThreads ?? 4);
}

