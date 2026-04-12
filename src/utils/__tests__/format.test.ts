import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatSize } from '../format';

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
});
