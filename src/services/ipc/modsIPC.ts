import { toIpcError } from './ipcError';

type ModsApi = Window['api']['mods'];

export type GuidedContentInstallStatus =
  | 'success'
  | 'duplicate'
  | 'invalid-archive'
  | 'runtime-blocked'
  | 'failure';

export type GuidedContentInstallIssueStatus = Exclude<GuidedContentInstallStatus, 'success'>;

export interface GuidedContentInstallIssue {
  fileName: string;
  status: GuidedContentInstallIssueStatus;
  message: string;
}

export interface GuidedContentInstallResult {
  status: GuidedContentInstallStatus;
  destination?: string;
  filename?: string;
  usedUrl?: string;
  issues: GuidedContentInstallIssue[];
}

function hasMods(): boolean {
  return typeof window !== 'undefined' && Boolean(window.api?.mods);
}

function hasMethod<K extends keyof ModsApi>(key: K): boolean {
  const api = typeof window !== 'undefined' ? window.api?.mods : undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireMods(methodName: string): ModsApi {
  const api = typeof window !== 'undefined' ? window.api?.mods : undefined;
  if (!api) {
    throw new Error(`[modsIPC] mods API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'modsIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const modsIPC = {
  searchMods(query: Parameters<ModsApi['searchMods']>[0]) {
    if (!hasMods() || !hasMethod('searchMods')) throw new Error('[modsIPC] No mods API available');
    return call('searchMods', () => requireMods('searchMods').searchMods(query));
  },

  getModVersions(query: Parameters<ModsApi['getModVersions']>[0]) {
    if (!hasMods() || !hasMethod('getModVersions')) throw new Error('[modsIPC] No mods API available');
    return call('getModVersions', () => requireMods('getModVersions').getModVersions(query));
  },

  installModFile(req: Parameters<ModsApi['installModFile']>[0]) {
    if (!hasMods() || !hasMethod('installModFile')) throw new Error('[modsIPC] No mods API available');
    return call('installModFile', () => requireMods('installModFile').installModFile(req));
  },
};

export type ModsIPC = typeof modsIPC;

export function isGuidedContentInstallResult(value: unknown): value is GuidedContentInstallResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.status === 'string' && Array.isArray(record.issues);
}
