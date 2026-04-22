// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Screenshot } from '../../../../../electron/services/screenshots/screenshotService';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { ScreenshotsTab } from '../ScreenshotsTab';

const t = createTranslator('en');
const listMock = vi.fn();
const formatDateMock = vi.fn((
  timestamp: number | undefined,
  unknownText = 'Unknown',
  _options?: Intl.DateTimeFormatOptions,
) => (timestamp ? `date:${timestamp}` : unknownText));
const formatNumberMock = vi.fn((value: number, _options?: Intl.NumberFormatOptions) => `count:${value}`);

const screenshots: Screenshot[] = [
  {
    name: 'first.png',
    path: '/instance/screenshots/first.png',
    url: 'file:///instance/screenshots/first.png',
    createdAt: 1_776_000_000_000,
    size: 1024,
  },
  {
    name: 'second.png',
    path: '/instance/screenshots/second.png',
    url: 'file:///instance/screenshots/second.png',
    createdAt: 1_776_000_100_000,
    size: 2048,
  },
];

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    formatDate: (...args: Parameters<typeof formatDateMock>) => formatDateMock(...args),
    formatNumber: (...args: Parameters<typeof formatNumberMock>) => formatNumberMock(...args),
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
    prompt: vi.fn(),
  }),
}));

vi.mock('../../../../services/ipc/screenshotsIPC', () => ({
  screenshotsIPC: {
    list: (...args: unknown[]) => listMock(...args),
    delete: vi.fn(),
    rename: vi.fn(),
    openFolder: vi.fn(),
  },
}));

describe('ScreenshotsTab locale formatting', () => {
  beforeEach(() => {
    listMock.mockReset();
    formatDateMock.mockClear();
    formatNumberMock.mockClear();
    listMock.mockResolvedValue(screenshots);
  });

  it('uses locale-aware helpers for screenshot count and created dates', async () => {
    render(<ScreenshotsTab instancePath="/instance" />);

    const summary = await screen.findByTestId('screenshots-summary');
    expect(summary.textContent).toContain('Saved');
    expect(summary.textContent).toContain('count:2');
    expect(screen.getByText('date:1776000000000')).toBeTruthy();
    expect(screen.getByText('date:1776000100000')).toBeTruthy();
    expect(formatNumberMock).toHaveBeenCalledWith(2);
    expect(formatDateMock).toHaveBeenCalledWith(1_776_000_000_000, '', { dateStyle: 'medium' });
  });
});
