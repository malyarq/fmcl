// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { APP_ICON_PATH, LAUNCHER_MARK_PATH, MEDIA_FALLBACK_PATH } from '../../../app/assets/branding';
import { ArtworkFallback } from '../ArtworkFallback';

describe('ArtworkFallback policy', () => {
  it('defaults content artwork to the neutral media fallback instead of the launcher mark or app icon', () => {
    expect(ArtworkFallback.defaultKind).toBe('content-artwork');
    expect(ArtworkFallback.getSrc()).toBe(MEDIA_FALLBACK_PATH);
    expect(ArtworkFallback.getSrc('product-mark')).toBe(LAUNCHER_MARK_PATH);
    expect(ArtworkFallback.getSrc('app-icon')).toBe(APP_ICON_PATH);
    expect(ArtworkFallback.isSource(MEDIA_FALLBACK_PATH)).toBe(true);
    expect(ArtworkFallback.isSource(LAUNCHER_MARK_PATH)).toBe(false);
    expect(ArtworkFallback.isSource(APP_ICON_PATH)).toBe(false);
  });

  it('renders neutral fallback artwork with the media role and frame by default', () => {
    const { container } = render(<ArtworkFallback alt="Missing artwork" decorative={false} />);

    const image = screen.getByRole('img', { name: 'Missing artwork' });

    expect(image.getAttribute('data-brand-role')).toBe('media-fallback');
    expect(image.getAttribute('src')).toBe(MEDIA_FALLBACK_PATH);
    expect(container.firstElementChild?.className).toContain('brand-media-frame');
  });
});
