import type { ETagEntry } from './etagCache';
import { ETagCache } from './etagCache';

/**
 * Updates ETag cache from HTTP response headers.
 */
export const updateEtagCacheFromResponse = (url: string, res: Response) => {
  const etag = res.headers.get('etag') ?? undefined;
  const lastModified = res.headers.get('last-modified') ?? undefined;
  if (!etag && !lastModified) return;
  ETagCache.set(url, { etag, lastModified, updatedAt: Date.now() });
};

/**
 * Attempts a conditional HEAD request to check if file has changed.
 */
export const tryConditionalHead = async (url: string, entry?: ETagEntry) => {
  if (!entry) return { skip: false };
  const headers: Record<string, string> = {};
  if (entry.etag) headers['if-none-match'] = entry.etag;
  if (entry.lastModified) headers['if-modified-since'] = entry.lastModified;
  try {
    const res = await fetch(url, { method: 'HEAD', headers });
    if (res.status === 304) {
      return { skip: true };
    }
    if (res.ok) {
      updateEtagCacheFromResponse(url, res);
    }
  } catch {
    // Ignore HEAD errors and fallback to download.
  }
  return { skip: false };
};

