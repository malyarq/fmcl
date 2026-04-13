// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ExportModpackPage } from '../ExportModpackPage';

const getMetadataMock = vi.fn();
const getDesktopPathMock = vi.fn();

type Language = 'en' | 'ru';

let currentLanguage: Language = 'en';

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: createTranslator(currentLanguage),
    getAccentStyles: () => ({ className: '', style: undefined }),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getMetadata: (...args: unknown[]) => getMetadataMock(...args),
    export: vi.fn(),
  },
}));

vi.mock('../../../services/ipc/dialogIPC', () => ({
  dialogIPC: {
    getDesktopPath: (...args: unknown[]) => getDesktopPathMock(...args),
    showSaveDialog: vi.fn(),
  },
}));

describe('ExportModpackPage i18n seams', () => {
  beforeEach(() => {
    cleanup();
    getMetadataMock.mockReset();
    getDesktopPathMock.mockReset();

    getMetadataMock.mockResolvedValue({
      name: 'Alpha Pack',
    });
    getDesktopPathMock.mockResolvedValue('C:\\Users\\tester\\Desktop');
  });

  it('renders the export route with translated English format labels and option copy', async () => {
    currentLanguage = 'en';

    const { container } = render(<ExportModpackPage modpackId="alpha" onBack={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Export Modpack' });

    expect(screen.getByText('Export Format')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'MultiMC / Prism Launcher / FriendLauncher (.zip)' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Raw ZIP Archive (Instance Copy)' })).toBeTruthy();
    expect(screen.getByText('Export options')).toBeTruthy();
    expect(screen.getByText('Include saved worlds (saves)')).toBeTruthy();
    expect(screen.getByText('Include screenshots')).toBeTruthy();
    expect(screen.getByText('Include resource packs')).toBeTruthy();
    expect(screen.getByText('Include shader packs')).toBeTruthy();
    expect(screen.getByText('Include mods (JAR files)')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByDisplayValue('C:\\Users\\tester\\Desktop\\Alpha Pack.zip')).toBeTruthy();
    });

    expect(container.textContent).not.toContain('modpacks.export_format_multimc');
    expect(container.textContent).not.toContain('modpacks.include_shaders');
    expect(container.textContent).not.toContain('modpacks.export_options');
  });

  it('renders the export route with translated Russian labels and no English fallback copy', async () => {
    currentLanguage = 'ru';

    const { container } = render(<ExportModpackPage modpackId="alpha" onBack={vi.fn()} />);

    await screen.findByRole('heading', { name: 'Экспорт модпака' });

    expect(screen.getByText('Формат экспорта')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Обычный ZIP-архив (копия инстанса)' })).toBeTruthy();
    expect(screen.getByText('Опции экспорта')).toBeTruthy();
    expect(screen.getByText('Включить сохранения миров (saves)')).toBeTruthy();
    expect(screen.getByText('Включить скриншоты')).toBeTruthy();
    expect(screen.getByText('Включить ресурспаки')).toBeTruthy();
    expect(screen.getByText('Включить шейдерпаки')).toBeTruthy();
    expect(screen.getByText('Включить моды (JAR-файлы)')).toBeTruthy();

    expect(container.textContent).not.toContain('modpacks.export_format_multimc');
    expect(container.textContent).not.toContain('modpacks.include_shaders');
    expect(container.textContent).not.toContain('Export options');
    expect(container.textContent).not.toContain('Raw ZIP Archive (Instance Copy)');
  });
});
