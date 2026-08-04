import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  stageCurseForgeModpack,
  stageModrinthModpack,
  type ProviderArchivePort,
  type ProviderContentPort,
  type ProviderDownloadPort,
} from '..';

const temporaryDirectories: string[] = [];

describe('provider staging installers', () => {
  afterEach(() => { for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });

  it('stages a CurseForge pack through injected provider, download, archive, and content ports without publishing state', async () => {
    const stagingRoot = temporaryRoot();
    const download = fakeDownload();
    const archive = fakeArchive('manifest.json', JSON.stringify(curseManifest()));
    const result = await stageCurseForgeModpack({
      provider: {
        getModFile: vi.fn(async (projectId: number, fileId: number) => projectId === 1 && fileId === 2
          ? { downloadUrl: 'https://downloads.example.com/pack.zip', hashes: [] }
          : { downloadUrl: 'https://downloads.example.com/mod.jar', fileName: 'safe.jar', hashes: [] }),
        getMod: vi.fn(async () => ({ name: 'Curse Pack', summary: 'Provider description', logo: { thumbnailUrl: 'https://images.example.com/icon.png' }, authors: [{ name: 'Author' }] })),
      } as never,
      download,
      archive,
      content: nodeContent(),
    }, { projectId: 1, fileId: 2, destinationId: 'curse-pack', stagingRoot });

    expect(result).toMatchObject({
      config: { id: 'curse-pack', runtime: { minecraft: '1.20.1' } },
      source: { source: 'curseforge', sourceId: '1', sourceVersionId: '2', version: '1.0.0' },
      content: { instanceId: 'curse-pack', descriptor: 'manifest.json' },
      missing: [],
    });
    expect(download.download).toHaveBeenCalledTimes(2);
    expect(fs.existsSync(path.join(stagingRoot, 'modpacks', 'curse-pack', 'modpack.json'))).toBe(true);
    expect(fs.existsSync(path.join(stagingRoot, 'modpacks.json'))).toBe(false);
    expect(fs.existsSync(path.join(stagingRoot, 'modpacks-metadata.json'))).toBe(false);
  });

  it('keeps optional Modrinth download failures degraded but rejects required failures before any control-plane write', async () => {
    const stagingRoot = temporaryRoot();
    const download = fakeDownload((input) => input.destination.endsWith('optional.jar') ? new Error('404') : undefined);
    const archive = fakeArchive('modrinth.index.json', JSON.stringify(modrinthManifest()));
    const result = await stageModrinthModpack({
      provider: {
        getProjectVersion: vi.fn(async () => ({ files: [{ filename: 'pack.mrpack', url: 'https://downloads.example.com/pack.mrpack', hashes: {} }], game_versions: ['1.20.1'], loaders: ['fabric'], version_number: '2.0.0', name: '2.0.0' })),
        getProject: vi.fn(async () => ({ title: 'Modrinth Pack', description: 'Provider description', icon_url: 'https://images.example.com/icon.png' })),
      } as never,
      download,
      archive,
      content: nodeContent(),
    }, { projectId: 'project', versionId: 'version', destinationId: 'modrinth-pack', stagingRoot });

    expect(result).toMatchObject({
      source: { source: 'modrinth', sourceId: 'project', sourceVersionId: 'version', version: '2.0.0' },
      missing: [{ path: 'mods/optional.jar', reason: '404' }],
    });
    expect(fs.existsSync(path.join(stagingRoot, 'modpacks.json'))).toBe(false);
    expect(fs.existsSync(path.join(stagingRoot, 'modpacks-metadata.json'))).toBe(false);
  });
});

function temporaryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-provider-installer-'));
  temporaryDirectories.push(root);
  return root;
}

function fakeDownload(failure?: (input: { destination: string }) => Error | undefined): ProviderDownloadPort & { download: ReturnType<typeof vi.fn> } {
  return { download: vi.fn(async (input) => { const error = failure?.(input); if (error) throw error; fs.mkdirSync(path.dirname(input.destination), { recursive: true }); fs.writeFileSync(input.destination, 'archive'); }) };
}

function fakeArchive(manifestName: string, manifest: string): ProviderArchivePort {
  return { extract: async (_source, destination) => { fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(path.join(destination, manifestName), manifest); } };
}

function nodeContent(): ProviderContentPort {
  return {
    createTemporaryDirectory: () => fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-provider-content-')),
    removeDirectory: (directory) => fs.rmSync(directory, { recursive: true, force: true }),
    exists: fs.existsSync,
    readText: (file) => fs.readFileSync(file, 'utf8'),
    writeText: (file, contents) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, contents); },
    ensureDirectory: (directory) => fs.mkdirSync(directory, { recursive: true }),
    copyFile: (source, destination) => { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination); },
    readDirectory: (directory) => fs.readdirSync(directory, { withFileTypes: true }).map((entry) => ({ name: entry.name, directory: entry.isDirectory() })),
  };
}

function curseManifest() {
  return { minecraft: { version: '1.20.1', modLoaders: [{ id: 'forge-47.0.0', primary: true }] }, manifestType: 'minecraftModpack', manifestVersion: 1, name: 'Curse Pack', version: '1.0.0', author: 'Author', files: [{ projectID: 3, fileID: 4, required: true }], overrides: 'overrides' };
}

function modrinthManifest() {
  return { formatVersion: 1, game: 'minecraft', versionId: '1.0.0', name: 'Modrinth Pack', summary: 'Summary', files: [{ path: 'mods/required.jar', hashes: {}, downloads: ['https://downloads.example.com/required.jar'], env: { client: 'required' } }, { path: 'mods/optional.jar', hashes: {}, downloads: ['https://downloads.example.com/optional.jar'], env: { client: 'optional' } } ], dependencies: { minecraft: '1.20.1', 'fabric-loader': '0.16.0' } };
}
