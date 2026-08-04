// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { AppearanceTab } from '../tabs/AppearanceTab';

describe('AppearanceTab keyboard and responsive contract', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('keeps preset and branding actions focusable inside a narrow-first composition', () => {
    localStorage.setItem('settings_language', 'ru');

    render(
      <SettingsProvider>
        <AppearanceTab />
      </SettingsProvider>,
    );

    const primaryGrid = screen.getByTestId('appearance-primary-grid');
    expect(primaryGrid.className).toContain('grid-cols-1');
    expect(screen.getByText(/Примените готовый профиль оболочки и поверхностей/i)).toBeTruthy();

    const presets = screen.getByTestId('appearance-presets');
    const branding = screen.getByTestId('appearance-branding');
    const presetSelect = within(presets).getByRole('combobox', { name: 'Готовые темы' });
    const importButton = within(presets).getByRole('button', { name: 'Импорт' });
    const accentButton = within(branding).getByRole('button', { name: 'Цвет акцента: emerald' });

    for (const control of [presetSelect, importButton, accentButton]) {
      control.focus();
      expect(document.activeElement).toBe(control);
    }
  });

  it('gives every conditional background control a programmatic keyboard label', () => {
    localStorage.setItem('settings_language', 'ru');
    localStorage.setItem('settings_customTheme', JSON.stringify({
      background: {
        type: 'video',
        video: {
          url: 'https://example.invalid/background.mp4',
          volume: 0.2,
          autoPause: true,
        },
      },
    }));

    render(
      <SettingsProvider>
        <AppearanceTab />
      </SettingsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Фоновые эффекты' }));

    const background = screen.getByTestId('appearance-background-controls');
    const backgroundType = within(background).getByRole('combobox', { name: 'Тип фона' });
    const videoUrl = within(background).getByRole('textbox', { name: 'URL видео (MP4/WebM)' });
    const volume = within(background).getByRole('slider', { name: 'Громкость' });
    const autoPause = within(background).getByRole('switch', { name: 'Автопауза в фоне' });
    const blur = within(background).getByRole('slider', { name: 'Размытие' });
    const opacity = within(background).getByRole('slider', { name: 'Прозрачность' });

    for (const control of [backgroundType, videoUrl, volume, autoPause, blur, opacity]) {
      control.focus();
      expect(document.activeElement).toBe(control);
    }
    expect(background.className).toContain('min-w-0');
  });
});
