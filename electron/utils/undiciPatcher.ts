import { createRequire } from 'node:module';
import { DEFAULT_USER_AGENT } from '@shared/constants';

type UndiciModuleRef = Record<string, unknown> & {
  request?: unknown;
  stream?: unknown;
  pipeline?: unknown;
};

let undiciPatched = false;

/**
 * Patch undici to avoid passing unsupported options and to ensure User-Agent is set.
 *
 * Why util: this is low-level wiring around third-party HTTP implementation,
 * not launcher orchestration logic.
 */
export function patchUndiciThrowOnError() {
  if (undiciPatched) return;
  const requireFn = createRequire(import.meta.url);

  const patchModule = (moduleRef: UndiciModuleRef | null | undefined) => {
    if (!moduleRef) return;
    const originalRequest = moduleRef.request;
    const originalStream = moduleRef.stream;
    const originalPipeline = moduleRef.pipeline;

    const wrapOptions = (opts?: Record<string, unknown>) => {
      if (!opts || typeof opts !== 'object') return opts;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { throwOnError: _ignored, maxRedirections: _drop, ...rest } = opts;
      const headers = rest.headers;
      if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
        const normalized: Record<string, string> = { ...(headers as Record<string, string>) };
        const hasUserAgent = Object.keys(normalized).some((key) => key.toLowerCase() === 'user-agent');
        if (!hasUserAgent) normalized['user-agent'] = DEFAULT_USER_AGENT;
        return { ...rest, headers: normalized };
      }
      if (!headers) {
        return { ...rest, headers: { 'user-agent': DEFAULT_USER_AGENT } };
      }
      return rest;
    };

    if (typeof originalRequest === 'function' && !(originalRequest as { __xmclPatched?: boolean }).__xmclPatched) {
      const wrapped = (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => {
        return (originalRequest as (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => unknown)(
          url,
          wrapOptions(opts),
          callback
        );
      };
      (wrapped as { __xmclPatched?: boolean }).__xmclPatched = true;
      moduleRef.request = wrapped;
    }

    if (typeof originalStream === 'function' && !(originalStream as { __xmclPatched?: boolean }).__xmclPatched) {
      const wrappedStream = (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => {
        return (originalStream as (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => unknown)(
          url,
          wrapOptions(opts),
          callback
        );
      };
      (wrappedStream as { __xmclPatched?: boolean }).__xmclPatched = true;
      moduleRef.stream = wrappedStream;
    }

    if (typeof originalPipeline === 'function' && !(originalPipeline as { __xmclPatched?: boolean }).__xmclPatched) {
      const wrappedPipeline = (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => {
        return (
          originalPipeline as (url: string | URL, opts?: Record<string, unknown>, callback?: unknown) => unknown
        )(url, wrapOptions(opts), callback);
      };
      (wrappedPipeline as { __xmclPatched?: boolean }).__xmclPatched = true;
      moduleRef.pipeline = wrappedPipeline;
    }
  };

  try {
    patchModule(requireFn('undici'));
  } catch {
    // Module not found or patch failed, continue
  }

  try {
    const installerEntry = requireFn.resolve('@xmcl/installer');
    const installerRequire = createRequire(installerEntry);
    patchModule(installerRequire('undici'));
  } catch {
    // Module not found or patch failed, continue
  }

  undiciPatched = true;
}

