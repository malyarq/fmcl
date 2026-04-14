import { describe, expect, it } from 'vitest';
import { resolveAnchoredOverlayLayout } from '../anchoredOverlayLayout';

describe('resolveAnchoredOverlayLayout', () => {
  it('keeps the preferred placement when there is enough room', () => {
    const layout = resolveAnchoredOverlayLayout({
      anchorRect: {
        top: 40,
        left: 100,
        right: 180,
        bottom: 72,
        width: 80,
        height: 32,
      },
      overlaySize: {
        width: 160,
        height: 96,
      },
      viewportSize: {
        width: 1280,
        height: 800,
      },
      placement: 'bottom',
      align: 'center',
    });

    expect(layout.placement).toBe('bottom');
    expect(layout.top).toBe(80);
    expect(layout.left).toBe(60);
  });

  it('flips to the opposite side when the preferred side overflows', () => {
    const layout = resolveAnchoredOverlayLayout({
      anchorRect: {
        top: 340,
        left: 120,
        right: 200,
        bottom: 372,
        width: 80,
        height: 32,
      },
      overlaySize: {
        width: 180,
        height: 120,
      },
      viewportSize: {
        width: 400,
        height: 420,
      },
      placement: 'bottom',
      align: 'end',
    });

    expect(layout.placement).toBe('top');
    expect(layout.top).toBe(212);
  });

  it('clamps the overlay inside the viewport near the right edge', () => {
    const layout = resolveAnchoredOverlayLayout({
      anchorRect: {
        top: 48,
        left: 292,
        right: 320,
        bottom: 76,
        width: 28,
        height: 28,
      },
      overlaySize: {
        width: 180,
        height: 120,
      },
      viewportSize: {
        width: 320,
        height: 240,
      },
      placement: 'bottom',
      align: 'end',
    });

    expect(layout.left).toBe(128);
    expect(layout.left + 180).toBeLessThanOrEqual(320 - 12);
  });
});
