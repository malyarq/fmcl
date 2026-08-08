import type { BurrowApi } from '@shared/contracts';

type SystemReadinessApi = BurrowApi['systemReadiness'];

export const systemReadinessIPC = {
  isAvailable: () => typeof window !== 'undefined' && Boolean(window.api?.systemReadiness),
  check() {
    const api = typeof window !== 'undefined' ? window.api?.systemReadiness : undefined;
    if (!api) return Promise.reject(new Error('System readiness API is not available'));
    return api.check();
  },
} satisfies Readonly<{ isAvailable(): boolean; check(): ReturnType<SystemReadinessApi['check']> }>;
