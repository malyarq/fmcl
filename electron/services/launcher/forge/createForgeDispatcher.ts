import { Agent, interceptors } from 'undici';

export function createForgeDispatcher() {
  // Forge library stage is the most common "silent stall" source.
  // Balance between fast failover (next mirror) and giving each mirror a fair chance.
  // Increased retries from 1 to 2 to handle temporary network issues and rate limiting.
  return new Agent({
    connections: 8,
    // Keep timeouts reasonable - don't timeout so aggressively that we truncate JAR/ZIPs.
    // Truncated downloads frequently surface as "end of central directory record signature not found".
    connectTimeout: 30_000,
    headersTimeout: 60_000,
    bodyTimeout: 180_000,
  }).compose(interceptors.retry({ maxRetries: 2 }), interceptors.redirect({ maxRedirections: 5 }));
}

