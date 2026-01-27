import fs from 'fs';
import { Buffer } from 'buffer';
import { HTML_CHALLENGE_MARKERS, HTML_PROBE_BYTES } from '@shared/constants';
import type { Dispatcher } from 'undici';

/**
 * Reads the first N bytes of a file for content inspection.
 */
export const readFileSnippet = (filePath: string, limit: number) => {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(limit);
    const bytesRead = fs.readSync(fd, buffer, 0, limit, 0);
    fs.closeSync(fd);
    return buffer.slice(0, bytesRead).toString('utf8');
  } catch {
    return '';
  }
};

/**
 * Detects if content is an HTML challenge page (e.g., Cloudflare protection).
 */
export const isHtmlChallenge = (snippet: string, contentType?: string | null) => {
  const trimmed = snippet.trimStart().toLowerCase();
  if (contentType?.includes('text/html')) return true;
  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) return true;
  return HTML_CHALLENGE_MARKERS.some((pattern) => pattern.test(snippet));
};

/**
 * Reads a snippet from a Response stream for content inspection.
 */
export const readResponseSnippet = async (res: Response, limitBytes: number) => {
  const reader = res.body?.getReader?.();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (received < limitBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = limitBytes - received;
      const slice = value.length > remaining ? value.slice(0, remaining) : value;
      chunks.push(slice);
      received += slice.length;
      if (received >= limitBytes) break;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore reader cancellation errors
    }
  }
  return Buffer.concat(chunks).toString('utf8');
};

/**
 * Probes a URL to detect if it returns an HTML challenge page instead of the expected file.
 */
export const probeHtmlChallenge = async (url: string, headers: Record<string, string>, dispatcher: Dispatcher) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      url,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          ...headers,
          range: `bytes=0-${HTML_PROBE_BYTES - 1}`,
          accept: '*/*',
        },
        signal: controller.signal,
        dispatcher,
      } as Parameters<typeof fetch>[1] & { dispatcher?: unknown }
    );
    const contentType = res.headers.get('content-type');
    const snippet = await readResponseSnippet(res, HTML_PROBE_BYTES);
    if (isHtmlChallenge(snippet, contentType)) {
      return { blocked: true, status: res.status, contentType };
    }
  } catch {
    // Ignore probe failures and fallback to download.
  } finally {
    clearTimeout(timeout);
  }
  return { blocked: false };
};

