import { describe, expect, it } from 'vitest';
import vitestConfig from '../../vitest.config';

describe('Vitest browser-suite boundary', () => {
  it('excludes Playwright specs while retaining accessibility unit suites', () => {
    const excludes = vitestConfig.test?.exclude ?? [];

    expect(excludes).toEqual(expect.arrayContaining([
      'tests/visual/**/*',
      'tests/performance/**/*',
      'tests/accessibility/renderer-accessibility.spec.ts',
    ]));
    expect(excludes).not.toContain('tests/accessibility/**/*');
  });
});
