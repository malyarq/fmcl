// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { AppearanceTab } from '../tabs/AppearanceTab';

function renderAppearanceTab() {
  return render(
    <SettingsProvider>
      <AppearanceTab />
    </SettingsProvider>,
  );
}

describe('AppearanceTab state fidelity', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('marks segmented controls and accent chips with explicit active and inactive state treatments', () => {
    localStorage.setItem('settings_theme', 'dark');
    localStorage.setItem('settings_language', 'en');
    localStorage.setItem('settings_accentColor', 'rose');

    renderAppearanceTab();

    const darkThemeButton = screen.getByRole('button', { name: 'Dark' });
    const lightThemeButton = screen.getByRole('button', { name: 'Light' });
    const englishButton = screen.getByRole('button', { name: 'English' });
    const russianButton = screen.getByRole('button', { name: 'Русский' });
    const roseAccentChip = screen.getByRole('button', { name: /rose/i });
    const advancedAppearanceToggle = screen.getByRole('button', { name: 'Advanced Appearance' });

    expect(darkThemeButton.getAttribute('aria-pressed')).toBe('true');
    expect(darkThemeButton.getAttribute('data-state')).toBe('active');
    expect(darkThemeButton.className).toContain('settings-segmented-option');

    expect(lightThemeButton.getAttribute('aria-pressed')).toBe('false');
    expect(lightThemeButton.getAttribute('data-state')).toBe('inactive');
    expect(lightThemeButton.className).toContain('settings-segmented-option');

    expect(englishButton.getAttribute('aria-pressed')).toBe('true');
    expect(englishButton.getAttribute('data-state')).toBe('active');
    expect(russianButton.getAttribute('aria-pressed')).toBe('false');
    expect(russianButton.getAttribute('data-state')).toBe('inactive');
    expect(russianButton.className).toContain('settings-segmented-option');

    expect(roseAccentChip.getAttribute('aria-pressed')).toBe('true');
    expect(roseAccentChip.getAttribute('data-state')).toBe('active');
    expect(roseAccentChip.className).toContain('ring-2');
    expect(roseAccentChip.className).toContain('scale-110');

    expect(advancedAppearanceToggle.getAttribute('aria-expanded')).toBe('false');
    expect(advancedAppearanceToggle.className).toContain('focus-visible:ring-2');
  });

  it('keeps preset ancestry visible when bounded refinements are layered on top', () => {
    localStorage.setItem('settings_theme', 'dark');
    localStorage.setItem('settings_language', 'en');
    localStorage.setItem('settings_themePresetId', 'forest');
    localStorage.setItem('settings_customTheme', JSON.stringify({
      colors: {
        background: '#123456',
      },
    }));

    renderAppearanceTab();

    expect(screen.getAllByText('Forest · Dark').length).toBeGreaterThan(0);
    expect(screen.getByText('Customized')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset to Preset' })).toBeTruthy();
  });
});
