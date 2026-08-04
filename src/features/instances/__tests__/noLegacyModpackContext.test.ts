import { access, readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = `${process.cwd()}/src`;
const LEGACY_CONTEXT_PATH = `${SOURCE_ROOT}/contexts/ModpackContext.tsx`;
const LEGACY_CREATE_MODAL_PATH = `${SOURCE_ROOT}/components/modpacks/CreateModpackModal.tsx`;
const LEGACY_REFERENCE = /\b(?:ModpackContext|ModpackProvider|useModpackListContext|useModpack)\b/;

describe('legacy Modpack context absence', () => {
  it('keeps production and manual renderer source on focused instance owners', async () => {
    expect(await findLegacyReferences()).toEqual([]);
  });

  it('does not restore deleted bridge or dead modal files', async () => {
    expect(await exists(LEGACY_CONTEXT_PATH)).toBe(false);
    expect(await exists(LEGACY_CREATE_MODAL_PATH)).toBe(false);
  });
});

async function findLegacyReferences(): Promise<string[]> {
  const files = await collectSourceFiles(SOURCE_ROOT);
  const references = await Promise.all(files
    .filter((file) => !file.includes('/__tests__/'))
    .map(async (file) => LEGACY_REFERENCE.test(await readFile(file, 'utf8')) ? file : null));

  return references
    .filter((file): file is string => file !== null)
    .map((file) => file.slice(`${process.cwd()}/`.length));
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(path));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
