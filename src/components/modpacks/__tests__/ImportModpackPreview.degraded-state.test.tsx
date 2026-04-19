// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportModpackPreviewPage } from '../ImportModpackPreviewPage';

const getModpackInfoFromFileMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => ({
      'modpacks.import_preview': 'Import Preview',
      'modpacks.loading': 'Loading...',
      'modpacks.unable_to_load_info': 'Unable to load modpack information',
      'general.back': 'Back',
      'degraded.error_label': 'Needs attention',
    }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatNumber: (value: number) => String(value),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getModpackInfoFromFile: (...args: unknown[]) => getModpackInfoFromFileMock(...args),
    import: vi.fn(),
  },
}));

describe('ImportModpackPreview degraded state', () => {
  beforeEach(() => {
    getModpackInfoFromFileMock.mockReset();
    refreshMock.mockReset();
  });

  it('shows a sanitized degraded error instead of raw preview failures', async () => {
    getModpackInfoFromFileMock.mockRejectedValue(new Error('[modpacksIPC] getModpackInfoFromFile failed: ${file.jarVersion}'));

    render(<ImportModpackPreviewPage filePath="/packs/broken.mrpack" onBack={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Unable to load modpack information' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Needs attention');
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });
});
