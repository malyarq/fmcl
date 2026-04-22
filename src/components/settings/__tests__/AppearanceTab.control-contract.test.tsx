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
  setCustomTheme: ReturnType<typeof vi.fn>;
};

let currentSettings: MockSettings;

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => currentSettings,
}));

import { AppearanceTab } from '../tabs/AppearanceTab';

function buildSettings(overrides: Partial<MockSettings> = {}): MockSettings {
  const customTheme = overrides.customTheme ?? {};

  return {
    accentColor: overrides.accentColor ?? 'emerald',
    setAccentColor: vi.fn(),
    theme: overrides.theme ?? 'dark',
    setTheme: vi.fn(),
    themePresetId: overrides.themePresetId ?? 'forest',
    applyThemePreset: vi.fn(),
    applyAppearanceState: vi.fn(),
    language: overrides.language ?? 'en',
    setLanguage: vi.fn(),
    t: createTranslator('en'),
    getAccentStyles: () => ({ style: {} }),
    customTheme,
    activeThemeConfig: customTheme,
    themeRuntimeState: overrides.themeRuntimeState ?? {
      activePresetId: 'forest',
      customizationScopes: Object.keys(customTheme).filter((scope) => scope.length > 0),
      hasCustomizations: Object.keys(customTheme).length > 0,
      matchesPresetDefaultMode: true,
    },
    setCustomTheme: vi.fn(),
  };
}

describe('AppearanceTab control contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('treats the custom accent path like the same chip family instead of an overlaid exception', () => {
    currentSettings = buildSettings({
      accentColor: '#123456',
      customTheme: {
        colors: {
          background: '#123456',
        },
      },
    });

    render(<AppearanceTab />);

    const presetChip = screen.getByRole('button', { name: 'Accent Color: emerald' });
    const customChip = screen.getByRole('button', { name: 'Accent Color: Custom Color' });
    const customInput = screen.getByLabelText('Custom Color');

    expect(presetChip.className).toContain('settings-accent-chip');
    expect(customChip.className).toContain('settings-accent-chip');
    expect(customChip.getAttribute('data-state')).toBe('active');
    expect(customChip.className).toContain('ring-2');
    expect(customChip.className).toContain('scale-110');
    expect(customInput.className).toContain('sr-only');
    expect(customInput.className).not.toContain('absolute');
  });

  it('uses the shared slider styling for background controls once the section is opened', () => {
    currentSettings = buildSettings({
      customTheme: {
        background: {
          type: 'particles',
          particles: {
            type: 'snow',
            intensity: 60,
            speed: 3,
          },
        },
      },
    });

    const { container } = render(<AppearanceTab />);
    screen.getByRole('button', { name: 'Background Effects' }).click();

    const sliders = Array.from(container.querySelectorAll('input[type="range"]'));

    expect(sliders.length).toBeGreaterThan(0);
    sliders.forEach((slider) => {
      expect(slider.className).toContain('settings-slider');
    });
  });
});
