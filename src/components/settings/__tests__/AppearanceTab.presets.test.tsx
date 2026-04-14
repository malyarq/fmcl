// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { AppearanceTab } from '../tabs/AppearanceTab';

function getRootVar(name: string) {
  return document.documentElement.style.getPropertyValue(name);
}

function renderAppearanceTab() {
  return render(
    <SettingsProvider>
      <AppearanceTab />
    </SettingsProvider>,
  );
}

function getPresetSelect() {
  return screen.getByRole('combobox', {
    name: 'Theme Presets',
  }) as HTMLSelectElement;
}

describe('AppearanceTab preset contract', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('stores the preset identity and applies its runtime colors immediately', async () => {
    renderAppearanceTab();

    fireEvent.change(getPresetSelect(), { target: { value: 'forest' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    expect(localStorage.getItem('settings_customTheme')).toBe('{}');
    expect(getPresetSelect().value).toBe('forest');
    expect(getRootVar('--bg-app')).toBe('5 46 22');
    expect(getRootVar('--bg-card')).toBe('6 78 59');
    expect(getRootVar('--text-main')).toBe('236 253 245');
    expect(screen.getByText('Forest · Dark')).toBeTruthy();
  });

  it('keeps the preset identity when switching theme mode and repaints to that preset variant', async () => {
    renderAppearanceTab();

    fireEvent.change(getPresetSelect(), { target: { value: 'forest' } });
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));

    await waitFor(() => {
      expect(localStorage.getItem('settings_theme')).toBe('light');
    });

    expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    expect(getPresetSelect().value).toBe('forest');
    expect(getRootVar('--bg-app')).toBe('236 253 245');
    expect(getRootVar('--bg-card')).toBe('209 250 229');
    expect(getRootVar('--text-main')).toBe('6 78 59');
    expect(screen.getByText('Forest · Light')).toBeTruthy();
  });

  it('migrates legacy preset-shaped custom theme storage into the new preset identity', async () => {
    localStorage.setItem('settings_theme', 'dark');
    localStorage.setItem('settings_customTheme', JSON.stringify({
      colors: {
        background: '#052e16',
        card: '#064e3b',
        textMain: '#ecfdf5',
        textSecondary: '#6ee7b7',
        border: '#065f46',
        error: '#f87171',
      },
    }));

    renderAppearanceTab();

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    expect(localStorage.getItem('settings_customTheme')).toBe('{}');
    expect(getPresetSelect().value).toBe('forest');
    expect(getRootVar('--bg-app')).toBe('5 46 22');
  });
});
