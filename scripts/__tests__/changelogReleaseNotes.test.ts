import { describe, expect, it } from 'vitest';
import { extractReleaseNotes } from '../changelog-release-notes.js';

const changelog = `# История изменений / Changelog

## Не выпущено / Unreleased

Изменений нет. / Nothing.

## [0.9.1] — 2026-08-07

### Русский

- Исправление безопасности.

### English

- Security fix.

## [0.9.0] — 2026-08-06

- Product features.

## [0.8.1] — 2026-08-06

- Older fix.
`;

describe('release notes from the current changelog entry', () => {
  it('includes only the requested release', () => {
    const notes = extractReleaseNotes(changelog, '0.9.1');
    expect(notes).toContain('## [0.9.1]');
    expect(notes).not.toContain('## [0.9.0]');
    expect(notes).not.toContain('## [0.8.1]');
    expect(notes).toContain('Пакеты не подписаны издателем');
    expect(notes.indexOf('### Русский')).toBeLessThan(notes.indexOf('### English'));
    expect(notes.indexOf('Пакеты не подписаны издателем')).toBeLessThan(notes.indexOf('Packages are unsigned'));
  });

  it('fails instead of silently publishing incomplete notes', () => {
    expect(() => extractReleaseNotes(changelog, '1.0.0')).toThrow('no entry for 1.0.0');
  });
});
