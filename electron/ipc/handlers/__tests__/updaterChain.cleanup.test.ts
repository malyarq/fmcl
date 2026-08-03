import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const legacyFiles = [
  'shared/contracts/updater.ts',
  'electron/ipc/handlers/updaterHandlers.ts',
  'electron/preload/bridges/UpdaterBridge.ts',
];
const sourceRoots = [
  'shared/contracts',
  'electron/ipc',
  'electron/preload',
  'src',
];

describe('legacy updater IPC cleanup', () => {
  it('removes the updater contract, IPC handler, preload bridge, and every renderer-facing reference', () => {
    for (const file of legacyFiles) {
      expect(fs.existsSync(path.join(repositoryRoot, file)), file).toBe(false);
    }

    const sourceText = sourceRoots
      .flatMap((sourceRoot) => listTypeScriptFiles(path.join(repositoryRoot, sourceRoot)))
      .filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`))
      .map((file) => `${path.relative(repositoryRoot, file)}\n${fs.readFileSync(file, 'utf8')}`)
      .join('\n');
    const documentationText = [
      readSource('docs/en/contracts-map.md'),
      readSource('docs/ru/contracts-map.md'),
    ].join('\n');

    expect(sourceText).not.toMatch(/['"]updater:[^'"]+['"]/);
    expect(sourceText).not.toContain('registerUpdaterHandlers');
    expect(sourceText).not.toMatch(/\bUpdaterBridge\b/);
    expect(sourceText).not.toContain('window.api.updater');
    expect(sourceText).not.toMatch(/from ['"](?:\.?\.\/)*updater['"]/);
    expect(sourceText).not.toMatch(/InstanceUpdater(?:API|Progress|SyncOptions)/);
    expect(documentationText).not.toContain('window.api.updater');
    expect(documentationText).not.toMatch(/`updater:[^`]+`/);
  });

  it('keeps the independent app-updater capability intact', () => {
    const channels = readSource('shared/contracts/ipcChannels.ts');
    const contracts = readSource('shared/contracts/index.ts');
    const windowApi = readSource('shared/contracts/windowApi.ts');
    const preload = readSource('electron/preload.ts');

    expect(channels).toContain("'app-updater:check'");
    expect(channels).toContain("'app-updater:progress'");
    expect(contracts).toContain("from './appUpdater'");
    expect(windowApi).toContain('appUpdater: AppUpdaterAPI');
    expect(preload).toContain('appUpdater');
  });
});

function listTypeScriptFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(entryPath);
    return entryPath.endsWith('.ts') || entryPath.endsWith('.tsx') ? [entryPath] : [];
  });
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}
