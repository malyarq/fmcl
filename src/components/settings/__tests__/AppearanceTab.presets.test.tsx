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

    expect(screen.getByTestId('appearance-presets').getAttribute('data-appearance-owner')).toBe('presets');

    fireEvent.change(getPresetSelect(), { target: { value: 'forest' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    expect(localStorage.getItem('settings_customTheme')).toBe('{}');
    expect(getPresetSelect().value).toBe('forest');
    expect(getRootVar('--bg-app')).toBe('5 46 22');
    expect(getRootVar('--bg-card')).toBe('6 78 59');
    expect(getRootVar('--text-main')).toBe('236 253 245');
    expect(screen.getAllByText('Forest · Dark').length).toBeGreaterThan(0);
    expect(screen.getByText('Preset default')).toBeTruthy();
    expect(screen.getByText('Untouched preset')).toBeTruthy();
  });

  it('keeps the preset identity when switching theme mode and repaints to that preset variant', async () => {
    renderAppearanceTab();

    fireEvent.change(getPresetSelect(), { target: { value: 'midnight' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('midnight');
    });

    expect(getRootVar('--accent-main')).toBe('168 85 247');
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));

    await waitFor(() => {
      expect(localStorage.getItem('settings_theme')).toBe('light');
    });

    expect(localStorage.getItem('settings_themePresetId')).toBe('midnight');
    expect(getPresetSelect().value).toBe('midnight');
    expect(getRootVar('--bg-app')).toBe('238 242 255');
    expect(getRootVar('--bg-card')).toBe('224 231 255');
    expect(getRootVar('--text-main')).toBe('17 24 39');
    expect(getRootVar('--accent-main')).toBe('59 130 246');
    expect(screen.getAllByText('Midnight · Light').length).toBeGreaterThan(0);
    expect(screen.getByText('Preset variant')).toBeTruthy();
  });

  it('keeps an explicit accent override when switching preset families', async () => {
    renderAppearanceTab();

    fireEvent.change(getPresetSelect(), { target: { value: 'midnight' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('midnight');
    });

    fireEvent.click(screen.getByRole('button', { name: /Accent Color: rose/i }));

    await waitFor(() => {
      expect(localStorage.getItem('settings_accentColor')).toBe('rose');
    });

    fireEvent.change(getPresetSelect(), { target: { value: 'navy' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('navy');
    });

    expect(localStorage.getItem('settings_accentColor')).toBe('rose');
    expect(getRootVar('--accent-main')).toBe('244 63 94');
    expect(screen.getByText('Customized preset')).toBeTruthy();
  });

  it('keeps an explicitly chosen mode when switching between preset families', async () => {
    renderAppearanceTab();

    fireEvent.change(getPresetSelect(), { target: { value: 'navy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));

    await waitFor(() => {
      expect(localStorage.getItem('settings_theme')).toBe('light');
    });

    fireEvent.change(getPresetSelect(), { target: { value: 'forest' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    expect(localStorage.getItem('settings_theme')).toBe('light');
    expect(getPresetSelect().value).toBe('forest');
    expect(getRootVar('--bg-app')).toBe('236 253 245');
    expect(screen.getAllByText('Forest · Light').length).toBeGreaterThan(0);
    expect(screen.getByText('Preset variant')).toBeTruthy();
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
      accentColor: string;
      customTheme: Record<string, unknown>;
      name: string;
      presetId?: string;
      theme: string;
    };

    expect(exportedTheme.accentColor).toBe('emerald');
    expect(exportedTheme.customTheme).toEqual({});
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
              accentColor: '#123456',
              customTheme: {},
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
    expect(screen.getAllByText('Forest · Dark').length).toBeGreaterThan(0);
    expect(localStorage.getItem('settings_accentColor')).toBe('#123456');
  });

  it('keeps preset ownership when a bounded advanced override is applied', async () => {
    const { container } = renderAppearanceTab();

    fireEvent.change(getPresetSelect(), { target: { value: 'forest' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advanced Appearance' }));

    const backgroundColorRow = screen.getByText('Background Color').closest('div');
    const backgroundColorInput = backgroundColorRow?.querySelector('input[type="color"]') as HTMLInputElement | null;
    expect(backgroundColorInput).toBeTruthy();
    if (!backgroundColorInput) {
      throw new Error('Expected background color input');
    }

    fireEvent.change(backgroundColorInput, { target: { value: '#112233' } });

    await waitFor(() => {
      expect(localStorage.getItem('settings_themePresetId')).toBe('forest');
    });

    expect(JSON.parse(localStorage.getItem('settings_customTheme') ?? '{}')).toEqual({
      colors: {
        background: '#112233',
      },
    });
    expect(container.textContent).toContain('Forest · Dark');
    expect(screen.getByText('Customized preset')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Return to Forest · Dark' })).toBeTruthy();
  });
});
