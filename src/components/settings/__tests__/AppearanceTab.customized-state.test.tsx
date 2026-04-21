// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('AppearanceTab customized state', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('labels preset-adjacent refinements as customized and lets the user reset back to the preset runtime contract', async () => {
    localStorage.setItem('settings_theme', 'dark');
    localStorage.setItem('settings_themePresetId', 'forest');
    localStorage.setItem('settings_customTheme', JSON.stringify({
      colors: {
        background: '#123456',
      },
    }));

    renderAppearanceTab();

    expect(screen.getAllByText('Forest · Dark').length).toBeGreaterThan(0);
    expect(screen.getByText('Customized')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset to Preset' }));

    await waitFor(() => {
      expect(localStorage.getItem('settings_customTheme')).toBe('{}');
    });

    await waitFor(() => {
      expect(screen.queryByText('Customized')).toBeNull();
    });
  });
});
