// Re-export constants from shared location for backward compatibility
// New code should import directly from '@shared/constants'
export {
  DEFAULT_USER_AGENT,
  DEFAULT_CONNECT_TIMEOUT,
  DEFAULT_HEADERS_TIMEOUT,
  DEFAULT_BODY_TIMEOUT,
  DEFAULT_RANGE_THRESHOLD,
  DEFAULT_RANGE_CONCURRENCY,
  PROGRESS_STALL_TIMEOUT,
  PROGRESS_CHECK_INTERVAL,
  HTML_PROBE_BYTES,
  HTML_CHALLENGE_MARKERS,
} from '@shared/constants';

