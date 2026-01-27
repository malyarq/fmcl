import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { DEFAULT_USER_AGENT } from '@shared/constants';

export function isHtmlResponse(data: Buffer, contentType?: string | null): boolean {
  if (contentType?.includes('text/html')) return true;
  if (data.length < 100) return false; // Too small to check
  const snippet = data
    .slice(0, Math.min(1024, data.length))
    .toString('utf8')
    .trimStart()
    .toLowerCase();
  return (
    snippet.startsWith('<!doctype html') ||
    snippet.startsWith('<html') ||
    /verifying your browser/i.test(snippet) ||
    /attention required/i.test(snippet) ||
    /cloudflare/i.test(snippet) ||
    /js required/i.test(snippet)
  );
}

export async function downloadFileDirectly(options: {
  url: string;
  destination: string;
  expectedSize?: number;
  onLog?: (data: string) => void;
  userAgent?: string;
}): Promise<void> {
  const { url, destination, expectedSize, onLog = () => {}, userAgent = DEFAULT_USER_AGENT } = options;

  const controller = new AbortController();
  // Reduced timeout for faster mirror switching (especially important for users in Russia/China)
  const PROGRESS_STALL_TIMEOUT = 8_000; // 8 seconds instead of 20
  const PROGRESS_CHECK_INTERVAL = 1_000; // Check every 1 second instead of 2

  const dir = path.dirname(destination);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const pendingFile = `${destination}.pending`;
  const cleanupFiles = () => {
    try {
      if (fs.existsSync(pendingFile)) fs.unlinkSync(pendingFile);
    } catch {
      // Ignore deletion errors
    }
  };
  cleanupFiles();

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': userAgent,
        accept: '*/*',
        'accept-encoding': 'identity',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : undefined;

    if (size) {
      onLog(`[Download] Expected size: ${Math.round(size / 1024)}KB`);
    }
    if (contentType) {
      onLog(`[Download] Content-Type: ${contentType}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    let downloadedBytes = 0;
    let lastProgressTime = Date.now();
    let lastDownloadedBytes = 0;
    const headerCapture: number[] = [];
    const snippetCapture: number[] = [];

    // Always write to a temp file first, then rename atomically.
    const out = fs.createWriteStream(pendingFile, { flags: 'wx' });
    let streamClosed = false;
    const closeStream = async () => {
      if (streamClosed) return;
      streamClosed = true;
      out.end();
      try {
        await once(out, 'close');
      } catch {
        // ignore close errors
      }
    };

    const progressMonitor = setInterval(() => {
      const timeSinceProgress = Date.now() - lastProgressTime;
      if (downloadedBytes === lastDownloadedBytes && timeSinceProgress >= PROGRESS_STALL_TIMEOUT) {
        clearInterval(progressMonitor);
        controller.abort();
      } else if (downloadedBytes > lastDownloadedBytes) {
        lastDownloadedBytes = downloadedBytes;
        lastProgressTime = Date.now();
      }
    }, PROGRESS_CHECK_INTERVAL);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          downloadedBytes += value.length;
          lastProgressTime = Date.now();
          if (headerCapture.length < 2) {
            for (let i = 0; i < value.length && headerCapture.length < 2; i++) headerCapture.push(value[i]);
          }
          if (snippetCapture.length < 1024) {
            for (let i = 0; i < value.length && snippetCapture.length < 1024; i++) snippetCapture.push(value[i]);
          }

          const buf = Buffer.from(value);
          if (!out.write(buf)) {
            await once(out, 'drain');
          }
        }
      }
    } finally {
      clearInterval(progressMonitor);
      await closeStream();
    }

    const stats = fs.statSync(pendingFile);
    const actualSize = stats.size;
    onLog(`[Download] Downloaded: ${Math.round(actualSize / 1024)}KB`);

    const snippetBuffer = Buffer.from(snippetCapture);
    if (isHtmlResponse(snippetBuffer, contentType)) {
      const snippet = snippetBuffer.toString('utf8');
      throw new Error(`Server returned HTML instead of file. Response starts with: ${snippet.substring(0, 100)}...`);
    }

    if (expectedSize && actualSize < expectedSize * 0.8) {
      throw new Error(
        `File too small: expected at least ${Math.round((expectedSize * 0.8) / 1024)}KB, got ${Math.round(actualSize / 1024)}KB`
      );
    }

    if (actualSize < 100) {
      throw new Error(`File too small (${actualSize} bytes), likely corrupted or incomplete`);
    }

    if (headerCapture.length < 2 || headerCapture[0] !== 0x50 || headerCapture[1] !== 0x4b) {
      throw new Error(`File doesn't appear to be a ZIP file (missing PK signature)`);
    }

    // Replace destination atomically.
    try {
      if (fs.existsSync(destination)) fs.unlinkSync(destination);
    } catch {
      // ignore
    }
    fs.renameSync(pendingFile, destination);
    onLog(`[Download] File saved successfully`);
  } catch (err: unknown) {
    try {
      cleanupFiles();
    } catch {
      // Ignore deletion errors
    }
    if (controller.signal.aborted && err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Download stalled - no progress for ${PROGRESS_STALL_TIMEOUT / 1000}s`);
    }
    throw err;
  }
}

