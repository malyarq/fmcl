// @vitest-environment jsdom

import type { CSSProperties } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import type {
  AccentStyleType,
  CustomThemeConfig,
  Language,
} from '../../../contexts/settings/types';

type MockSettings = {
  accentColor: string;
  setAccentColor: ReturnType<typeof vi.fn>;
  theme: 'dark' | 'light';
  setTheme: ReturnType<typeof vi.fn>;
  themePresetId: string | null;
  applyThemePreset: ReturnType<typeof vi.fn>;
  language: Language;
  setLanguage: ReturnType<typeof vi.fn>;
  t: ReturnType<typeof createTranslator>;
  getAccentStyles: (type: AccentStyleType) => { className?: string; style?: CSSProperties };
  customTheme: CustomThemeConfig;
  activeThemeConfig: CustomThemeConfig;
  clearThemePreset: ReturnType<typeof vi.fn>;
  setCustomTheme: ReturnType<typeof vi.fn>;
  uiScale: number;
  setUiScale: ReturnType<typeof vi.fn>;
  disableAnimations: boolean;
  setDisableAnimations: ReturnType<typeof vi.fn>;
  sidebarPosition: 'left' | 'right';
  setSidebarPosition: ReturnType<typeof vi.fn>;
  compactMode: boolean;
  setCompactMode: ReturnType<typeof vi.fn>;
};

const setAccentColorMock = vi.fn();
const setThemeMock = vi.fn();
const applyThemePresetMock = vi.fn();
const setLanguageMock = vi.fn();
const setCustomThemeMock = vi.fn();
const clearThemePresetMock = vi.fn();
const setUiScaleMock = vi.fn();
const setDisableAnimationsMock = vi.fn();
const setSidebarPositionMock = vi.fn();
const setCompactModeMock = vi.fn();

let currentSettings: MockSettings;

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => currentSettings,
}));

import { AppearanceTab } from '../tabs/AppearanceTab';

function buildSettings(language: Language): MockSettings {
  return {
    accentColor: 'emerald',
    setAccentColor: setAccentColorMock,
    theme: 'dark',
    setTheme: setThemeMock,
    themePresetId: null,
    applyThemePreset: applyThemePresetMock,
    language,
    setLanguage: setLanguageMock,
    t: createTranslator(language),
    getAccentStyles: () => ({ style: {} }),
    customTheme: {
      colors: {
        background: '#111111',
      },
      background: {
        type: 'particles',
        particles: {
          type: 'snow',
          intensity: 65,
          speed: 3,
        },
      },
    },
    activeThemeConfig: {
      colors: {
        background: '#111111',
      },
      background: {
        type: 'particles',
        particles: {
          type: 'snow',
          intensity: 65,
          speed: 3,
        },
      },
    },
    clearThemePreset: clearThemePresetMock,
    setCustomTheme: setCustomThemeMock,
    uiScale: 100,
    setUiScale: setUiScaleMock,
    disableAnimations: false,
    setDisableAnimations: setDisableAnimationsMock,
    sidebarPosition: 'left',
    setSidebarPosition: setSidebarPositionMock,
    compactMode: false,
    setCompactMode: setCompactModeMock,
  };
}

describe('AppearanceTab i18n seams', () => {
  beforeEach(() => {
    localStorage.clear();
    setAccentColorMock.mockReset();
    setThemeMock.mockReset();
    applyThemePresetMock.mockReset();
    setLanguageMock.mockReset();
    setCustomThemeMock.mockReset();
    clearThemePresetMock.mockReset();
    setUiScaleMock.mockReset();
    setDisableAnimationsMock.mockReset();
    setSidebarPositionMock.mockReset();
    setCompactModeMock.mockReset();

    currentSettings = buildSettings('en');
  });

  it('renders the touched appearance controls with translated English copy and no raw settings keys', () => {
    currentSettings = buildSettings('en');

    const { container } = render(<AppearanceTab />);

    expect(screen.getByText('Launcher Accent')).toBeTruthy();
    expect(screen.getAllByText('Theme Presets').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Advanced Appearance' })).toBeTruthy();
    expect(screen.getByText('Background Type')).toBeTruthy();
    expect(screen.getByText('Particle Type')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Interface Zoom' })).toBeTruthy();
    expect(screen.getByText('Sidebar Position')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset Custom Theme' })).toBeTruthy();

    expect(container.textContent).not.toContain('settings.appearance_branding');
    expect(container.textContent).not.toContain('settings.theme_presets');
    expect(container.textContent).not.toContain('settings.background_type');
    expect(container.textContent).not.toContain('settings.ui_scalability');
    expect(container.textContent).not.toContain('settings.sidebar_position');
    expect(container.textContent).not.toContain('settings.reset_custom_theme');
  });

  it('renders Russian translations for the touched appearance controls without falling back to raw keys or English literals', () => {
    currentSettings = buildSettings('ru');

    const { container } = render(<AppearanceTab />);

    expect(screen.getByText('Акцент лаунчера')).toBeTruthy();
    expect(screen.getAllByText('Готовые темы').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Расширенный внешний вид' })).toBeTruthy();
    expect(screen.getByText('Тип фона')).toBeTruthy();
    expect(screen.getByText('Тип частиц')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Масштаб интерфейса' })).toBeTruthy();
    expect(screen.getByText('Положение сайдбара')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Сбросить кастомную тему' })).toBeTruthy();

    expect(container.textContent).not.toContain('settings.appearance_branding');
    expect(container.textContent).not.toContain('settings.theme_presets');
    expect(container.textContent).not.toContain('settings.background_type');
    expect(container.textContent).not.toContain('settings.ui_scalability');
    expect(container.textContent).not.toContain('settings.sidebar_position');
    expect(container.textContent).not.toContain('settings.reset_custom_theme');
    expect(container.textContent).not.toContain('Theme Presets');
    expect(container.textContent).not.toContain('Background Type');
    expect(container.textContent).not.toContain('UI Scalability');
    expect(container.textContent).not.toContain('Sidebar Position');
    expect(container.textContent).not.toContain('Reset Custom Theme');
  });
});
