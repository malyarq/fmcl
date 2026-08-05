import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';

let styles = '';

beforeAll(async () => {
  styles = await readFile(new URL('../../index.css', import.meta.url), 'utf8');
});

const scrollingSurfaceClasses = [
  'surface-panel',
  'surface-card',
  'surface-muted',
  'surface-inline',
  'control-frame',
] as const;

function getClassRule(className: string) {
  const match = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`).exec(styles);

  if (!match) {
    throw new Error(`Missing shared surface style: .${className}`);
  }

  return match[1];
}

describe('shared scrolling surface styles', () => {
  it('avoids backdrop filters on opaque reusable surfaces', () => {
    for (const className of scrollingSurfaceClasses) {
      const rule = getClassRule(className);

      expect(rule).not.toMatch(/backdrop-(?:blur|filter)/);
      expect(rule).toMatch(/bg-(?:card|background)\/(?:9[0-9])/);
    }
  });
});
