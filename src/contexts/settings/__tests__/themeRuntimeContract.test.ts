// @vitest-environment jsdom

import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsProvider, useSettings } from '../../SettingsContext';
import { resolveThemeConfig } from '../theme';

type SettingsSnapshot = ReturnType<typeof useSettings>;

let latestSettings: SettingsSnapshot | null = null;

function SettingsProbe({ onChange }: { onChange: (settings: SettingsSnapshot) => void }) {
  const settings = useSettings();

  useEffect(() => {
    onChange(settings);
  }, [onChange, settings]);

  return null;
}

describe('theme runtime contract', () => {
  beforeEach(() => {
    latestSettings = null;
    localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('re-inferrs preset identity when legacy empty preset storage and preset-shaped config are imported', async () => {
    localStorage.setItem('settings_theme', 'dark');
    localStorage.setItem('settings_themePresetId', '');
    localStorage.setItem('settings_customTheme', JSON.stringify(resolveThemeConfig('dark', 'forest')));

    render(
      React.createElement(
        SettingsProvider,
        null,
        React.createElement(SettingsProbe, {
          onChange: (settings: SettingsSnapshot) => {
            latestSettings = settings;
          },
        }),
      ),
    );

    await waitFor(() => {
      expect(latestSettings?.themePresetId).toBe('forest');
    });

    expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    expect(localStorage.getItem('settings_customTheme')).toBe('{}');
  });

  it('binds date and number formatting to the active FMCL language locale', async () => {
    render(
      React.createElement(
        SettingsProvider,
        null,
        React.createElement(SettingsProbe, {
          onChange: (settings: SettingsSnapshot) => {
            latestSettings = settings;
          },
        }),
      ),
    );

    act(() => {
      latestSettings?.setLanguage('ru');
    });

    await waitFor(() => {
      expect(latestSettings?.locale).toBe('ru-RU');
    });

    expect(
      latestSettings?.formatDate(1_744_441_600_000, 'N/A', { month: 'short', day: 'numeric' }),
    ).toBe(new Date(1_744_441_600_000).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
    expect(latestSettings?.formatNumber(1234567.89)).toBe(new Intl.NumberFormat('ru-RU').format(1234567.89));

    act(() => {
      latestSettings?.setLanguage('en');
    });

    await waitFor(() => {
      expect(latestSettings?.locale).toBe('en-US');
    });

    expect(latestSettings?.formatNumber(1234567.89)).toBe(new Intl.NumberFormat('en-US').format(1234567.89));
  });
});
