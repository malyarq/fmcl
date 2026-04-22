// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { applyThemeToDocument, resolveThemeConfig } from '../theme';

function getRootVar(name: string) {
  return document.documentElement.style.getPropertyValue(name);
}

describe('applyThemeToDocument', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('toggles dark mode classes and applies the full document token contract for the active base theme', () => {
    const root = document.documentElement;

    root.style.setProperty('--bg-app', '1 1 1');
    root.style.setProperty('--bg-card', '2 2 2');
    root.style.setProperty('--text-main', '3 3 3');
    root.style.setProperty('--border-default', '4 4 4');
    root.style.setProperty('--accent-main', '9 9 9');
    root.style.setProperty('--accent-hover', '9 9 9');
    root.style.setProperty('--accent-content', '0 0 0');

    applyThemeToDocument('dark', 'blue');

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(true);
    expect(getRootVar('--accent-main')).toBe('59 130 246');
    expect(getRootVar('--accent-hover')).toBe('37 99 235');
    expect(getRootVar('--accent-content')).toBe('255 255 255');
    expect(getRootVar('--bg-app')).toBe('24 24 27');
    expect(getRootVar('--bg-card')).toBe('39 39 42');
    expect(getRootVar('--bg-overlay')).toBe('24 24 27');
    expect(getRootVar('--bg-sidebar')).toBe('39 39 42');
    expect(getRootVar('--text-main')).toBe('255 255 255');
    expect(getRootVar('--text-secondary')).toBe('212 212 216');
    expect(getRootVar('--text-muted')).toBe('161 161 170');
    expect(getRootVar('--border-default')).toBe('63 63 70');
    expect(getRootVar('--border-active')).toBe('113 113 122');
    expect(getRootVar('--color-error')).toBe('220 38 38');

    applyThemeToDocument('light', 'rose');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.body.classList.contains('dark')).toBe(false);
    expect(getRootVar('--accent-main')).toBe('244 63 94');
    expect(getRootVar('--accent-hover')).toBe('225 29 72');
    expect(getRootVar('--accent-content')).toBe('24 24 27');
    expect(getRootVar('--bg-app')).toBe('244 244 245');
    expect(getRootVar('--bg-card')).toBe('255 255 255');
    expect(getRootVar('--bg-overlay')).toBe('255 255 255');
    expect(getRootVar('--bg-sidebar')).toBe('255 255 255');
    expect(getRootVar('--text-main')).toBe('24 24 27');
    expect(getRootVar('--text-secondary')).toBe('82 82 91');
    expect(getRootVar('--text-muted')).toBe('113 113 122');
    expect(getRootVar('--border-default')).toBe('228 228 231');
    expect(getRootVar('--border-active')).toBe('161 161 170');
    expect(getRootVar('--color-error')).toBe('220 38 38');
  });

  it('applies custom theme color variables and derives dependent document vars from the same runtime contract', () => {
    applyThemeToDocument('light', '#123456', {
      colors: {
        background: '#112233',
        card: '#abcdef',
        textMain: '#fedcba',
        textSecondary: '#445566',
        border: '#778899',
        error: '#ff0000',
      },
    });

    expect(getRootVar('--accent-main')).toBe('18 52 86');
    expect(getRootVar('--accent-hover')).toBe('15 43 71');
    expect(getRootVar('--accent-content')).toBe('24 24 27');
    expect(getRootVar('--bg-app')).toBe('17 34 51');
    expect(getRootVar('--bg-card')).toBe('171 205 239');
    expect(getRootVar('--bg-overlay')).toBe('171 205 239');
    expect(getRootVar('--bg-sidebar')).toBe('171 205 239');
    expect(getRootVar('--text-main')).toBe('254 220 186');
    expect(getRootVar('--text-secondary')).toBe('68 85 102');
    expect(getRootVar('--text-muted')).toBe('68 85 102');
    expect(getRootVar('--border-default')).toBe('119 136 153');
    expect(getRootVar('--border-active')).toBe('119 136 153');
    expect(getRootVar('--color-error')).toBe('255 0 0');
  });

  it('resolves one preset identity into the correct light and dark runtime variants', () => {
    const lightForest = resolveThemeConfig('light', 'forest');
    const darkForest = resolveThemeConfig('dark', 'forest');

    expect(lightForest.colors?.background).toBe('#ecfdf5');
    expect(darkForest.colors?.background).toBe('#052e16');

    applyThemeToDocument('light', 'emerald', lightForest);
    expect(getRootVar('--bg-app')).toBe('236 253 245');
    expect(getRootVar('--text-main')).toBe('6 78 59');

    applyThemeToDocument('dark', 'emerald', darkForest);
    expect(getRootVar('--bg-app')).toBe('5 46 22');
    expect(getRootVar('--text-main')).toBe('236 253 245');
    expect(getRootVar('--border-default')).toBe('6 95 70');
  });

  it('keeps preset ancestry readable when bounded overrides are layered on top of the active variant', () => {
    const runtimeConfig = resolveThemeConfig('light', 'forest', {
      colors: {
        background: '#112233',
      },
    });

    applyThemeToDocument('light', 'emerald', runtimeConfig);

    expect(getRootVar('--bg-app')).toBe('17 34 51');
    expect(getRootVar('--bg-card')).toBe('209 250 229');
    expect(getRootVar('--text-main')).toBe('6 78 59');
    expect(getRootVar('--border-default')).toBe('110 231 183');
  });
});
