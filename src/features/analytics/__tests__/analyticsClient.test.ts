// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_INSTALL_ID_KEY,
  createAnalyticsClient,
  normalizePostHogHost,
  persistAnalyticsConsent,
} from '../analyticsClient';

describe('privacy-first analytics client', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends nothing and creates no identifier before explicit consent', async () => {
    const fetcher = vi.fn();
    const client = createAnalyticsClient({
      fetcher,
      projectToken: 'phc_public_project_token',
      randomId: () => 'install-id',
      storage: localStorage,
    });

    await expect(client.capture('app_opened', { language: 'en', ui_mode: 'simple' })).resolves.toBe('disabled');
    expect(fetcher).not.toHaveBeenCalled();
    expect(localStorage.getItem(ANALYTICS_INSTALL_ID_KEY)).toBeNull();
  });

  it('uses the public capture endpoint with anonymous, allowlisted properties only', async () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
    const fetcher = vi.fn().mockResolvedValue({ ok: true } as Response);
    const client = createAnalyticsClient({
      fetcher,
      host: 'https://eu.i.posthog.com/project/path',
      platform: 'linux',
      projectToken: 'phc_public_project_token',
      randomId: () => 'install-id',
      storage: localStorage,
    });

    await expect(client.capture('game_launch_failed', { failure_stage: 'launch', loader: 'fabric' })).resolves.toBe('sent');

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [requestUrl, request] = fetcher.mock.calls[0] as [URL, NonNullable<Parameters<typeof fetch>[1]>];
    expect(requestUrl.toString()).toBe('https://eu.i.posthog.com/i/v0/e/');
    expect(request.credentials).toBe('omit');
    expect(request.referrerPolicy).toBe('no-referrer');

    const payload = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(payload).toMatchObject({
      api_key: 'phc_public_project_token',
      distinct_id: 'install-id',
      event: 'game_launch_failed',
      properties: {
        $geoip_disable: true,
        $process_person_profile: false,
        app_platform: 'linux',
        failure_stage: 'launch',
        loader: 'fabric',
      },
    });
    const propertyKeys = Object.keys(payload.properties as Record<string, unknown>).sort();
    expect(propertyKeys).toEqual([
      '$geoip_disable',
      '$process_person_profile',
      'app_platform',
      'app_version',
      'failure_stage',
      'loader',
    ]);
  });

  it('deletes the anonymous installation id when consent is withdrawn', () => {
    localStorage.setItem(ANALYTICS_INSTALL_ID_KEY, 'old-id');
    persistAnalyticsConsent(false, localStorage);

    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('denied');
    expect(localStorage.getItem(ANALYTICS_INSTALL_ID_KEY)).toBeNull();
  });

  it('migrates pre-rebrand consent and anonymous id without changing their meaning', async () => {
    localStorage.setItem('fmcl_analytics_consent', 'granted');
    localStorage.setItem('fmcl_analytics_install_id', 'legacy-install-id');
    const fetcher = vi.fn().mockResolvedValue({ ok: true } as Response);
    const client = createAnalyticsClient({ fetcher, projectToken: 'phc_public_project_token', storage: localStorage });

    await expect(client.capture('app_opened', { language: 'ru', ui_mode: 'simple' })).resolves.toBe('sent');
    const payload = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as { distinct_id: string };
    expect(payload.distinct_id).toBe('legacy-install-id');
    expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe('granted');
    expect(localStorage.getItem(ANALYTICS_INSTALL_ID_KEY)).toBe('legacy-install-id');
    expect(localStorage.getItem('fmcl_analytics_consent')).toBeNull();
    expect(localStorage.getItem('fmcl_analytics_install_id')).toBeNull();
  });

  it('rejects insecure or credential-bearing analytics hosts', () => {
    expect(normalizePostHogHost('http://posthog.example')).toBeNull();
    expect(normalizePostHogHost('https://user:pass@posthog.example')).toBeNull();
    expect(normalizePostHogHost('https://posthog.example/path')).toBe('https://posthog.example');
  });
});
