import fs from 'node:fs';
import path from 'node:path';
import type { Dispatcher } from 'undici';
import { DefaultRangePolicy, download, type ChecksumValidatorOptions } from '@xmcl/file-transfer';
import { reportMirrorFailure, reportMirrorSuccess } from '../mirrors/scoring';
import { DEFAULT_RANGE_CONCURRENCY, DEFAULT_RANGE_THRESHOLD, HTML_PROBE_BYTES, PROGRESS_STALL_TIMEOUT } from '@shared/constants';
import { getDispatcher } from './dispatcherFactory';
import { ETagCache } from './etagCache';
import { tryConditionalHead, updateEtagCacheFromResponse } from './etagHttp';
import { probeHtmlChallenge, readFileSnippet, isHtmlChallenge } from './htmlChallengeDetector';
import { normalizeHeaders, shouldValidateZip } from './headers';
import { monitorDownloadProgress } from './progressMonitor';
import { validateZipIntegrity } from './zipValidator';

type DownloadSingleOptions = {
  checksum?: ChecksumValidatorOptions;
  expectedTotal?: number;
  headers?: Record<string, string>;
  maxRedirections?: number;
  retryCount?: number;
  maxSockets?: number;
  rangeThresholdBytes?: number;
  rangeConcurrency?: number;
  validateZip?: boolean;
  dispatcher?: Dispatcher;
};

export class DownloadManager {
  /**
   * Download a single file from URL to destination.
   * @param url Source URL or URL candidates
   * @param dest Destination absolute path
   */
  public static async downloadSingle(url: string | string[], dest: string, options: DownloadSingleOptions = {}): Promise<void> {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const candidates = Array.isArray(url) ? url : [url];
    const rangePolicy = new DefaultRangePolicy(
      options.rangeThresholdBytes ?? DEFAULT_RANGE_THRESHOLD,
      options.rangeConcurrency ?? DEFAULT_RANGE_CONCURRENCY
    );
    const dispatcher = options.dispatcher ?? getDispatcher(options.maxSockets, options.retryCount, options.maxRedirections);
    const headers = normalizeHeaders(options.headers);
    const shouldProbe = !options.checksum && !shouldValidateZip(dest, options.validateZip);
    const pendingFile = `${dest}.pending`;

    // Remove old .pending files before starting download to avoid using corrupted files
    try {
      if (fs.existsSync(pendingFile)) {
        fs.unlinkSync(pendingFile);
      }
    } catch {
      // Ignore deletion errors
    }

    const errors: Error[] = [];
    for (const candidate of candidates) {
      const startedAt = Date.now();
      let downloaded = false;
      try {
        const cacheEntry = ETagCache.get(candidate);
        if (fs.existsSync(dest)) {
          const { skip } = await tryConditionalHead(candidate, cacheEntry);
          if (skip) {
            reportMirrorSuccess(candidate, Date.now() - startedAt);
            return;
          }
        }

        if (shouldProbe) {
          const probe = await probeHtmlChallenge(candidate, headers, dispatcher);
          if (probe.blocked) {
            throw new Error(`Mirror returned HTML challenge (${probe.status ?? 'unknown'})`);
          }
        }

        // Monitor download progress and abort if progress stalls
        const progressAbortController = new AbortController();
        const stopMonitoring = monitorDownloadProgress(pendingFile, progressAbortController);

        try {
          const downloadPromise = download({
            url: candidate,
            destination: dest,
            pendingFile,
            headers,
            expectedTotal: options.expectedTotal,
            validator: options.checksum,
            // Type conflict between undici versions - @xmcl/file-transfer uses different undici types
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dispatcher: dispatcher as any,
            rangePolicy,
          });

          const progressMonitorPromise = new Promise<never>((_, reject) => {
            progressAbortController.signal.addEventListener('abort', () => {
              // Remove pending file so download can't use it
              try {
                if (fs.existsSync(pendingFile)) {
                  fs.unlinkSync(pendingFile);
                }
              } catch {
                // Ignore deletion errors
              }
              reject(new Error(`Download stalled - no progress for ${PROGRESS_STALL_TIMEOUT / 1000}s`));
            });
          });

          await Promise.race([downloadPromise, progressMonitorPromise]);
        } catch (downloadErr) {
          stopMonitoring();
          // If download was aborted due to no progress, try next source
          const errorMessage = downloadErr instanceof Error ? downloadErr.message : String(downloadErr);
          if (errorMessage.includes('stalled')) {
            // Ensure pending file is removed
            try {
              if (fs.existsSync(pendingFile)) {
                fs.unlinkSync(pendingFile);
              }
            } catch {
              // Ignore deletion errors
            }
            throw downloadErr;
          }
          throw downloadErr;
        } finally {
          stopMonitoring();
        }
        downloaded = true;

        if (shouldProbe) {
          const snippet = readFileSnippet(dest, HTML_PROBE_BYTES);
          if (isHtmlChallenge(snippet, null)) {
            throw new Error('Downloaded HTML challenge instead of file');
          }
        }

        // Check file size before validation - truncated downloads are a common issue
        const stats = fs.statSync(dest);
        if (stats.size === 0) {
          throw new Error('Downloaded file is empty (0 bytes)');
        }
        
        // Quick check: if file is suspiciously small (< 100 bytes) and we have a checksum,
        // verify it's not the empty file SHA1 before proceeding
        // SHA1 of empty file: da39a3ee5e6b4b0d3255bfef95601890afd80709
        if (stats.size < 100 && options.checksum) {
          const crypto = await import('node:crypto');
          const hash = crypto.createHash('sha1');
          const fileContent = fs.readFileSync(dest);
          hash.update(fileContent);
          const actualSha1 = hash.digest('hex');
          const emptyFileSha1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709';
          if (actualSha1 === emptyFileSha1) {
            throw new Error('Downloaded file is empty (SHA1 matches empty file hash)');
          }
        }
        
        if (options.expectedTotal && stats.size !== options.expectedTotal) {
          throw new Error(`File size mismatch: expected ${options.expectedTotal} bytes, got ${stats.size} bytes`);
        }

        if (shouldValidateZip(dest, options.validateZip)) {
          await validateZipIntegrity(dest);
        }

        reportMirrorSuccess(candidate, Date.now() - startedAt);
        try {
          const res = await fetch(candidate, { method: 'HEAD' });
          if (res.ok) updateEtagCacheFromResponse(candidate, res);
        } catch {
          // Ignore cache update errors
        }
        return;
      } catch (err) {
        reportMirrorFailure(candidate);
        const e = err instanceof Error ? err : new Error(String(err));
        // Preserve URL context for callers (and for RuntimeDownloadService.recordBadHosts).
        (e as Error & { url?: string }).url = candidate;
        
        // Check if error is related to checksum validation or empty file
        const isChecksumError = e.message.includes('checksum') || e.message.includes('sha1') || e.message.includes('hash');
        const isEmptyFileError = e.message.includes('empty') || e.message.includes('0 bytes');
        
        // Add file size info to error message if file exists
        try {
          if (fs.existsSync(dest)) {
            const stats = fs.statSync(dest);
            const sizeInfo = stats.size > 0 ? ` (file size: ${stats.size} bytes)` : ' (file is empty)';
            e.message = `${e.message}${sizeInfo}`;
            
            // If file is empty or has checksum error, it's corrupted and should be deleted
            if (isEmptyFileError || isChecksumError || stats.size === 0) {
              try {
                fs.unlinkSync(dest);
                e.message = `${e.message} [corrupted file deleted]`;
              } catch {
                // Ignore deletion errors
              }
            }
          }
        } catch {
          // Ignore stat errors
        }
        
        errors.push(e);
        try {
          // Always clean up downloaded files on error to prevent reuse of corrupted files
          if (downloaded && fs.existsSync(dest)) {
            fs.unlinkSync(dest);
          }
          if (fs.existsSync(pendingFile)) {
            fs.unlinkSync(pendingFile);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
    if (errors.length > 1) {
      const combined = new Error('All download candidates failed');
      (combined as Error & { errors?: Error[] }).errors = errors;
      throw combined;
    }
    throw errors[0];
  }
}

