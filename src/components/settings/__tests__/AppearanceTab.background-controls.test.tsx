// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CSSProperties } from 'react';
import type { AccentStyleType, CustomThemeConfig, Language } from '../../../contexts/settings/types';
import { createTranslator } from '../../../contexts/settings/i18n';

type MockSettings = {
  accentColor: string;
  setAccentColor: ReturnType<typeof vi.fn>;
  theme: 'dark' | 'light';
  setTheme: ReturnType<typeof vi.fn>;
  themePresetId: string | null;
  applyThemePreset: ReturnType<typeof vi.fn>;
  applyAppearanceState: ReturnType<typeof vi.fn>;
  language: Language;
  setLanguage: ReturnType<typeof vi.fn>;
  t: ReturnType<typeof createTranslator>;
  getAccentStyles: (type: AccentStyleType) => { className?: string; style?: CSSProperties };
  customTheme: CustomThemeConfig;
  activeThemeConfig: CustomThemeConfig;
  themeRuntimeState: {
    activePresetId: string | null;
    customizationScopes: string[];
    hasCustomizations: boolean;
    matchesPresetDefaultMode: boolean;
  };
  clearThemePreset: ReturnType<typeof vi.fn>;
  setCustomTheme: ReturnType<typeof vi.fn>;
};

let currentSettings: MockSettings;

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => currentSettings,
}));

import { AppearanceTab } from '../tabs/AppearanceTab';

function buildSettings(customTheme: CustomThemeConfig): MockSettings {
  return {
    accentColor: 'emerald',
    setAccentColor: vi.fn(),
    theme: 'dark',
    setTheme: vi.fn(),
    themePresetId: 'forest',
    applyThemePreset: vi.fn(),
    applyAppearanceState: vi.fn(),
    language: 'en',
    setLanguage: vi.fn(),
    t: createTranslator('en'),
    getAccentStyles: () => ({ style: {} }),
    customTheme,
    activeThemeConfig: customTheme,
    themeRuntimeState: {
      activePresetId: 'forest',
      customizationScopes: Object.keys(customTheme).filter((scope) => scope.length > 0),
      hasCustomizations: Object.keys(customTheme).length > 0,
      matchesPresetDefaultMode: true,
    },
    clearThemePreset: vi.fn(),
    setCustomTheme: vi.fn(),
  };
}

describe('AppearanceTab background controls', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows only particle controls when particles are the active background type', () => {
    currentSettings = buildSettings({
      background: {
        type: 'particles',
        particles: {
          type: 'snow',
          intensity: 60,
          speed: 3,
        },
      },
    });

    render(<AppearanceTab />);
    screen.getByRole('button', { name: 'Background Effects' }).click();

    expect(screen.getByTestId('appearance-background-controls').getAttribute('data-appearance-owner')).toBe('background');
    expect(screen.getByText('Visible Background Scope')).toBeTruthy();
    expect(screen.getByText(/shell frame and backdrop around this modal/i)).toBeTruthy();
    expect(screen.getByText('Particle Type')).toBeTruthy();
    expect(screen.getByText('Intensity')).toBeTruthy();
    expect(screen.queryByText('Background Image URL')).toBeNull();
    expect(screen.queryByText('Video URL (MP4/WebM)')).toBeNull();
  });

  it('shows only video controls when video is the active background type', () => {
    currentSettings = buildSettings({
      background: {
        type: 'video',
        video: {
          url: 'https://example.invalid/background.mp4',
          volume: 0.2,
          autoPause: true,
        },
      },
    });

    render(<AppearanceTab />);
    screen.getByRole('button', { name: 'Background Effects' }).click();

    expect(screen.getByTestId('appearance-background-controls').getAttribute('data-appearance-owner')).toBe('background');
    expect(screen.getByText('Visible Background Scope')).toBeTruthy();
    expect(screen.getByText('Video URL (MP4/WebM)')).toBeTruthy();
    expect(screen.getByText('Auto-Pause (Inactive)')).toBeTruthy();
    expect(screen.queryByText('Particle Type')).toBeNull();
    expect(screen.queryByText('Background Image URL')).toBeNull();
  });
});
