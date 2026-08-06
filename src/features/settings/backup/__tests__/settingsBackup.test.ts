// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { applySettingsBackup, collectSettingsBackup } from '../settingsBackup';

describe('settings backup allowlist', () => {
  beforeEach(() => localStorage.clear());

  it('exports preferences and recent launches without room secrets or analytics identity', () => {
    localStorage.setItem('settings_language', 'ru');
    localStorage.setItem('nickname', 'Alex');
    localStorage.setItem('lastGame_classic', '{"versionId":"1.21"}');
    localStorage.setItem('mp_join_code', 'secret-room-code');
    localStorage.setItem('fmcl_analytics_install_id', 'private-install-id');
    localStorage.setItem('settings_minecraftPath', '/Users/alex/private/.minecraft');
    localStorage.setItem('settings_futureToken', 'future-secret');

    expect(collectSettingsBackup()).toEqual({
      lastGame_classic: '{"versionId":"1.21"}',
      nickname: 'Alex',
      settings_language: 'ru',
    });
  });

  it('replaces only backed-up preferences and keeps unrelated local data', () => {
    localStorage.setItem('settings_language', 'en');
    localStorage.setItem('settings_theme', 'light');
    localStorage.setItem('fmcl_analytics_consent', 'granted');

    applySettingsBackup({ settings_language: 'ru', nickname: 'Steve' });

    expect(localStorage.getItem('settings_language')).toBe('ru');
    expect(localStorage.getItem('settings_theme')).toBeNull();
    expect(localStorage.getItem('nickname')).toBe('Steve');
    expect(localStorage.getItem('fmcl_analytics_consent')).toBe('granted');
  });
});
