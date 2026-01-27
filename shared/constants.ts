/**
 * Centralized constants for the entire application.
 * These constants are shared between Electron main process and can be imported
 * from both electron/ and shared/ contexts.
 */

// User-Agent string for HTTP requests
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Network timeouts (extended for slow connections)
export const DEFAULT_CONNECT_TIMEOUT = 30_000; // 30 seconds
export const DEFAULT_HEADERS_TIMEOUT = 60_000; // 60 seconds
export const DEFAULT_BODY_TIMEOUT = 180_000; // 3 minutes

// Download-specific constants
export const DEFAULT_RANGE_THRESHOLD = 5 * 1024 * 1024; // 5 MB
export const DEFAULT_RANGE_CONCURRENCY = 4;

// Progress monitoring
export const PROGRESS_STALL_TIMEOUT = 20_000; // 20 seconds without progress
export const PROGRESS_CHECK_INTERVAL = 2_000; // Check every 2 seconds

// HTML challenge detection
export const HTML_PROBE_BYTES = 16 * 1024;
export const HTML_CHALLENGE_MARKERS = [
  /verifying your browser/i,
  /attention required/i,
  /cloudflare/i,
  /js required/i,
  /enable javascript/i,
  /browser verification/i,
];
