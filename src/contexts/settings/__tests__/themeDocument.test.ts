// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { applyThemeToDocument } from '../theme';

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

  it('toggles dark mode classes, updates accent variables, and clears prior custom vars when no custom theme is provided', () => {
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
    expect(getRootVar('--accent-hover')).toBe('59 130 246');
    expect(getRootVar('--accent-content')).toBe('255 255 255');
    expect(getRootVar('--bg-app')).toBe('');
    expect(getRootVar('--bg-card')).toBe('');
    expect(getRootVar('--text-main')).toBe('');
    expect(getRootVar('--border-default')).toBe('');

    applyThemeToDocument('light', 'rose');

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.body.classList.contains('dark')).toBe(false);
    expect(getRootVar('--accent-main')).toBe('244 63 94');
    expect(getRootVar('--accent-hover')).toBe('244 63 94');
    expect(getRootVar('--accent-content')).toBe('24 24 27');
  });

  it('applies custom theme color variables and custom accent hex values as rgb document vars', () => {
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
    expect(getRootVar('--accent-hover')).toBe('18 52 86');
    expect(getRootVar('--accent-content')).toBe('24 24 27');
    expect(getRootVar('--bg-app')).toBe('17 34 51');
    expect(getRootVar('--bg-card')).toBe('171 205 239');
    expect(getRootVar('--bg-sidebar')).toBe('171 205 239');
    expect(getRootVar('--text-main')).toBe('254 220 186');
    expect(getRootVar('--text-secondary')).toBe('68 85 102');
    expect(getRootVar('--border-default')).toBe('119 136 153');
    expect(getRootVar('--color-error')).toBe('255 0 0');
  });
});
