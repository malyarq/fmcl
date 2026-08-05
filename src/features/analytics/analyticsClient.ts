import pkg from '../../../package.json';

export const ANALYTICS_CONSENT_KEY = 'fmcl_analytics_consent';
export const ANALYTICS_INSTALL_ID_KEY = 'fmcl_analytics_install_id';
export const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

type AnalyticsPlatform = 'windows' | 'macos' | 'linux' | 'other';
type ModLoader = 'vanilla' | 'forge' | 'fabric' | 'neoforge';

export type AnalyticsEventMap = {
  app_opened: {
    language: 'en' | 'ru';
    ui_mode: 'simple' | 'modpacks';
  };
  game_launch_started: {
    loader: ModLoader;
  };
  game_launch_succeeded: {
    loader: ModLoader;
  };
  game_launch_failed: {
    failure_stage: 'ipc_unavailable' | 'launch';
    loader: ModLoader;
  };
  feedback_opened: {
    source: 'launcher_settings';
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
export type AnalyticsCaptureResult = 'sent' | 'disabled' | 'unconfigured' | 'failed';

type AnalyticsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type AnalyticsFetcher = typeof fetch;

export interface AnalyticsClient {
  readonly configured: boolean;
  readonly host: string;
  capture<K extends AnalyticsEventName>(event: K, properties: AnalyticsEventMap[K]): Promise<AnalyticsCaptureResult>;
  clearInstallId(): void;
}

type AnalyticsClientOptions = {
  fetcher?: AnalyticsFetcher;
  host?: string;
  platform?: AnalyticsPlatform;
  projectToken?: string;
  randomId?: () => string;
  storage?: AnalyticsStorage | null;
};

function browserStorage(): AnalyticsStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function browserFetcher(): AnalyticsFetcher | undefined {
  return typeof fetch === 'function' ? fetch.bind(globalThis) : undefined;
}

function createRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const values = crypto.getRandomValues(new Uint32Array(4));
    return Array.from(values, (value) => value.toString(16).padStart(8, '0')).join('');
  }

  throw new Error('Secure random identifiers are unavailable.');
}

export function detectAnalyticsPlatform(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): AnalyticsPlatform {
  const normalized = userAgent.toLowerCase();
  if (normalized.includes('windows')) return 'windows';
  if (normalized.includes('macintosh') || normalized.includes('mac os')) return 'macos';
  if (normalized.includes('linux')) return 'linux';
  return 'other';
}

export function normalizePostHogHost(candidate: string | undefined): string | null {
  try {
    const url = new URL(candidate?.trim() || DEFAULT_POSTHOG_HOST);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(storage: AnalyticsStorage | null = browserStorage()): boolean {
  return storage?.getItem(ANALYTICS_CONSENT_KEY) === 'granted';
}

export function persistAnalyticsConsent(enabled: boolean, storage: AnalyticsStorage | null = browserStorage()): void {
  if (!storage) return;
  storage.setItem(ANALYTICS_CONSENT_KEY, enabled ? 'granted' : 'denied');
  if (!enabled) storage.removeItem(ANALYTICS_INSTALL_ID_KEY);
}

export function createAnalyticsClient(options: AnalyticsClientOptions = {}): AnalyticsClient {
  const projectToken = options.projectToken?.trim() ?? '';
  const host = normalizePostHogHost(options.host);
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const fetcher = options.fetcher ?? browserFetcher();
  const platform = options.platform ?? detectAnalyticsPlatform();
  const randomId = options.randomId ?? createRandomId;
  const configured = Boolean(projectToken && host && fetcher && storage);

  function getInstallId(): string {
    const existing = storage?.getItem(ANALYTICS_INSTALL_ID_KEY);
    if (existing) return existing;

    const created = randomId();
    storage?.setItem(ANALYTICS_INSTALL_ID_KEY, created);
    return created;
  }

  return {
    configured,
    host: host ?? '',
    async capture<K extends AnalyticsEventName>(event: K, properties: AnalyticsEventMap[K]): Promise<AnalyticsCaptureResult> {
      if (!hasAnalyticsConsent(storage)) return 'disabled';
      if (!configured || !host || !fetcher) return 'unconfigured';

      try {
        const response = await fetcher(new URL('/i/v0/e/', host), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: projectToken,
            distinct_id: getInstallId(),
            event,
            properties: {
              $process_person_profile: false,
              app_platform: platform,
              app_version: pkg.version,
              ...properties,
            },
          }),
          credentials: 'omit',
          keepalive: true,
          referrerPolicy: 'no-referrer',
        });

        return response.ok ? 'sent' : 'failed';
      } catch {
        return 'failed';
      }
    },
    clearInstallId(): void {
      storage?.removeItem(ANALYTICS_INSTALL_ID_KEY);
    },
  };
}

export const analyticsClient = createAnalyticsClient({
  projectToken: import.meta.env.VITE_POSTHOG_PROJECT_TOKEN,
  host: import.meta.env.VITE_POSTHOG_HOST,
});
