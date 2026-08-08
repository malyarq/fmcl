#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function extractReleaseNotes(changelog, currentVersion) {
  const headings = [...changelog.matchAll(/^## \[([^\]]+)\][^\n]*$/gm)]
    .map((match) => ({ version: match[1], start: match.index }));
  const currentIndex = headings.findIndex((heading) => heading.version === currentVersion);
  if (currentIndex === -1) throw new Error(`CHANGELOG.md has no entry for ${currentVersion}`);

  const next = headings[currentIndex + 1];
  const section = changelog.slice(headings[currentIndex].start, next?.start ?? changelog.length).trim();

  return [
    `# Burrow ${currentVersion}`,
    '',
    'All documented changes for this release / все документированные изменения этого релиза.',
    '',
    section,
    '',
    'Packages are unsigned. Verify the downloaded file against `SHA256SUMS.txt`.',
    '',
    'Пакеты не подписаны издателем. Сверьте скачанный файл с `SHA256SUMS.txt`.',
    '',
  ].join('\n');
}

export function main(args = process.argv.slice(2)) {
  const current = option(args, '--current');
  const output = option(args, '--output');
  if (!current || !output) throw new Error('Usage: changelog-release-notes.js --current <version> --output <file>');
  const changelog = readFileSync(resolve('CHANGELOG.md'), 'utf8');
  writeFileSync(resolve(output), extractReleaseNotes(changelog, current));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
