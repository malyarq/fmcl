import { Agent, interceptors, type Dispatcher } from 'undici';
import { DEFAULT_BODY_TIMEOUT, DEFAULT_CONNECT_TIMEOUT, DEFAULT_HEADERS_TIMEOUT } from '@shared/constants';

const dispatcherCache = new Map<string, Dispatcher>();

export const getDispatcher = (maxSockets = 64, retryCount = 5, maxRedirections = 5): Dispatcher => {
  // Use parameter combination for caching, so different retryCount values create different dispatchers
  const key = `${maxSockets}-${retryCount}`;
  const cached = dispatcherCache.get(key);
  if (cached) return cached;
  const agent = new Agent({
    connections: maxSockets,
    connectTimeout: DEFAULT_CONNECT_TIMEOUT,
    headersTimeout: DEFAULT_HEADERS_TIMEOUT,
    bodyTimeout: DEFAULT_BODY_TIMEOUT,
  }).compose(interceptors.retry({ maxRetries: retryCount }), interceptors.redirect({ maxRedirections }));
  dispatcherCache.set(key, agent);
  return agent;
};

