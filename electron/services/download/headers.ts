import { DEFAULT_USER_AGENT } from '@shared/constants';

/**
 * Normalizes HTTP headers, ensuring User-Agent is present.
 */
export const normalizeHeaders = (headers?: Record<string, string>) => {
  const result = { ...(headers ?? {}) };
  const hasUserAgent = Object.keys(result).some((key) => key.toLowerCase() === 'user-agent');
  if (!hasUserAgent) result['user-agent'] = DEFAULT_USER_AGENT;
  return result;
};

/**
 * Determines if a file should be validated as a ZIP archive.
 */
export const shouldValidateZip = (dest: string, explicit?: boolean) => {
  if (explicit !== undefined) return explicit;
  return dest.endsWith('.jar') || dest.endsWith('.zip');
};

