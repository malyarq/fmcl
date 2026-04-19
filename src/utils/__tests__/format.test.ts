import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDateForLocale, formatNumberForLocale, formatSize } from '../format';

describe('formatSize', () => {
  it('returns Unknown for missing sizes', () => {
    expect(formatSize(undefined)).toBe('Unknown');
  });

  it('formats zero bytes explicitly', () => {
    expect(formatSize(0)).toBe('0 B');
  });

  it('formats kilobytes and megabytes without trailing zero noise', () => {
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(1024 * 1024)).toBe('1 MB');
  });
});

describe('formatDate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the fallback for missing or zero timestamps', () => {
    expect(formatDate(undefined)).toBe('Unknown');
    expect(formatDate(0, 'N/A')).toBe('N/A');
  });

  it('delegates to locale date formatting for valid timestamps', () => {
    const toLocaleDateStringSpy = vi
      .spyOn(Date.prototype, 'toLocaleDateString')
      .mockReturnValue('2026-04-12');

    expect(formatDate(1_744_441_600_000)).toBe('2026-04-12');
    expect(toLocaleDateStringSpy).toHaveBeenCalledTimes(1);
  });

  it('formats dates against an explicit app locale contract when provided', () => {
    expect(
      formatDateForLocale(
        1_744_441_600_000,
        'ru-RU',
        'N/A',
        { month: 'short', day: 'numeric' },
      ),
    ).toBe(new Date(1_744_441_600_000).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }));
  });
});

describe('formatNumberForLocale', () => {
  it('formats numbers using the provided locale contract', () => {
    expect(formatNumberForLocale(1234567.89, 'en-US')).toBe(new Intl.NumberFormat('en-US').format(1234567.89));
    expect(formatNumberForLocale(1234567.89, 'ru-RU')).toBe(new Intl.NumberFormat('ru-RU').format(1234567.89));
  });
});
