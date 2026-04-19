// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '../../../contexts/SettingsContext';
import { resolveThemeConfig } from '../../../contexts/settings/theme';
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

  it('exports the localized preset summary while keeping the stable preset identity', async () => {
    let exportBlob: Blob | null = null;
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      exportBlob = blob as Blob;
      return 'blob:theme-export';
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderAppearanceTab();

    fireEvent.change(getPresetSelect(), { target: { value: 'forest' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(exportBlob).toBeTruthy();

    const exportedTheme = JSON.parse(await exportBlob!.text()) as {
      name: string;
      presetId?: string;
      theme: string;
    };

    expect(exportedTheme.name).toBe('Forest · Dark');
    expect(exportedTheme.presetId).toBe('forest');
    expect(exportedTheme.theme).toBe('dark');

    createObjectUrlSpy.mockRestore();
    clickSpy.mockRestore();
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

  it('restores the preset identity when importing an exported preset payload', async () => {
    const fileReaderMock = class {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsText() {
        this.onload?.({
          target: {
            result: JSON.stringify({
              presetId: 'forest',
              theme: 'dark',
              config: resolveThemeConfig('dark', 'forest'),
            }),
          },
        } as ProgressEvent<FileReader>);
      }
    };

    vi.stubGlobal('FileReader', fileReaderMock as unknown as typeof FileReader);

    renderAppearanceTab();

    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeTruthy();

    fireEvent.change(fileInput!, {
      target: {
        files: [new File(['{}'], 'friend-launcher-theme.json', { type: 'application/json' })],
      },
    });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    expect(getPresetSelect().value).toBe('forest');
    expect(screen.getByText('Forest · Dark')).toBeTruthy();
  });
});
