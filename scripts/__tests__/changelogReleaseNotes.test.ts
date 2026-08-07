import { describe, expect, it } from 'vitest';
import { extractReleaseNotes } from '../changelog-release-notes.js';

const changelog = `# Changelog

## Unreleased

Nothing.

## [0.9.1] — 2026-08-07

- Security fix.

## [0.9.0] — 2026-08-06

- Product features.

## [0.8.1] — 2026-08-06

- Older fix.
`;

describe('release notes from published release boundaries', () => {
  it('includes skipped tagged versions until the previous published release', () => {
    const notes = extractReleaseNotes(changelog, '0.9.1', '0.8.1');
    expect(notes).toContain('## [0.9.1]');
    expect(notes).toContain('## [0.9.0]');
    expect(notes).not.toContain('## [0.8.1]');
    expect(notes).toContain('Пакеты не подписаны издателем');
  });

  it('fails instead of silently publishing incomplete notes', () => {
    expect(() => extractReleaseNotes(changelog, '1.0.0', '0.9.1')).toThrow('no entry for 1.0.0');
    expect(() => extractReleaseNotes(changelog, '0.9.0', '0.9.1')).toThrow('not older');
  });
});
