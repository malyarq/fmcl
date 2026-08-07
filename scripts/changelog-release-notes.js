#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function extractReleaseNotes(changelog, currentVersion, previousVersion) {
  const headings = [...changelog.matchAll(/^## \[([^\]]+)\][^\n]*$/gm)]
    .map((match) => ({ version: match[1], start: match.index }));
  const currentIndex = headings.findIndex((heading) => heading.version === currentVersion);
  if (currentIndex === -1) throw new Error(`CHANGELOG.md has no entry for ${currentVersion}`);

  let endIndex = currentIndex + 1;
  if (previousVersion) {
    const previousIndex = headings.findIndex((heading) => heading.version === previousVersion);
    if (previousIndex === -1) throw new Error(`CHANGELOG.md has no entry for previous published version ${previousVersion}`);
    if (previousIndex <= currentIndex) throw new Error(`previous published version ${previousVersion} is not older than ${currentVersion} in CHANGELOG.md`);
    endIndex = previousIndex;
  }

  const sections = headings.slice(currentIndex, endIndex).map((heading, index) => {
    const next = headings[currentIndex + index + 1];
    const end = next?.start ?? changelog.length;
    return changelog.slice(heading.start, end).trim();
  });
  const range = previousVersion
    ? `since the published v${previousVersion} release / после опубликованного релиза v${previousVersion}`
    : 'for this release / для этого релиза';

  return [
    `# FriendLauncher ${currentVersion}`,
    '',
    `All documented changes ${range}.`,
    '',
    ...sections.flatMap((section) => [section, '']),
    'Packages are unsigned. Verify the downloaded file against `SHA256SUMS.txt`.',
    '',
    'Пакеты не подписаны издателем. Сверьте скачанный файл с `SHA256SUMS.txt`.',
    '',
  ].join('\n');
}

export function main(args = process.argv.slice(2)) {
  const current = option(args, '--current');
  const previous = option(args, '--previous');
  const output = option(args, '--output');
  if (!current || !output) throw new Error('Usage: changelog-release-notes.js --current <version> [--previous <version>] --output <file>');
  const changelog = readFileSync(resolve('CHANGELOG.md'), 'utf8');
  writeFileSync(resolve(output), extractReleaseNotes(changelog, current, previous));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
