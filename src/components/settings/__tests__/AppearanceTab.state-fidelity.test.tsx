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
    expect(darkThemeButton.className).toContain('bg-[rgb(var(--accent-main)/0.14)]');
    expect(darkThemeButton.className).toContain('focus-visible:ring-2');

    expect(lightThemeButton.getAttribute('aria-pressed')).toBe('false');
    expect(lightThemeButton.getAttribute('data-state')).toBe('inactive');
    expect(lightThemeButton.className).toContain('hover:border-[rgb(var(--accent-main)/0.16)]');

    expect(englishButton.getAttribute('aria-pressed')).toBe('true');
    expect(englishButton.getAttribute('data-state')).toBe('active');
    expect(russianButton.getAttribute('aria-pressed')).toBe('false');
    expect(russianButton.className).toContain('hover:bg-card/92');

    expect(roseAccentChip.getAttribute('aria-pressed')).toBe('true');
    expect(roseAccentChip.getAttribute('data-state')).toBe('active');
    expect(roseAccentChip.className).toContain('ring-2');
    expect(roseAccentChip.className).toContain('scale-110');

    expect(advancedAppearanceToggle.getAttribute('aria-expanded')).toBe('false');
    expect(advancedAppearanceToggle.className).toContain('focus-visible:ring-2');
  });

  it('keeps sliders accent-bound and disabled actions readable for custom accents', () => {
    localStorage.setItem('settings_theme', 'dark');
    localStorage.setItem('settings_language', 'en');
    localStorage.setItem('settings_accentColor', '#123456');
    localStorage.setItem('settings_uiScale', '100');

    renderAppearanceTab();

    const [uiScaleSlider] = screen.getAllByRole('slider');
    const resetZoomButton = screen.getByRole('button', { name: 'Reset' });

    expect(uiScaleSlider.className).toContain('accent-[rgb(var(--accent-main))]');
    expect((uiScaleSlider as HTMLInputElement).style.accentColor).toBeTruthy();
    expect((resetZoomButton as HTMLButtonElement).disabled).toBe(true);
    expect(resetZoomButton.className).toContain('disabled:bg-background/72');
    expect(resetZoomButton.className).toContain('disabled:text-muted');
  });
});
