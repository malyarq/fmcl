import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createProviderInstallOperationAdapters, type ProviderInstallers } from '../providerInstallOperation';
import { OperationRunner } from '../operationRunner';
import { OperationJournal } from '../operationJournal';

describe('staged provider install operations', () => {
  const tempDirs: string[] = [];

  afterEach(() => { for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });

  it.each([
    ['install-curseforge', 'required URL failure'],
    ['install-modrinth', 'required hash failure'],
  ] as const)('fails %s before publish on a %s', async (kind, reason) => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const before = capture(rootPath);
    const runner = new OperationRunner(createProviderInstallOperationAdapters({
      installers: failingInstallers(reason),
    }));

    const started = runner.start(request(kind, rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('reports only declared optional misses with their exact path and reason after publish', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const runner = new OperationRunner(createProviderInstallOperationAdapters({ installers: optionalInstallers() }));

    const started = runner.start(request('install-modrinth', rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({
      status: 'degraded',
      result: { status: 'degraded', missing: [{ path: 'mods/optional.jar', reason: 'download URL returned 404' }] },
    });
    expect(fs.readFileSync(path.join(rootPath, 'modpacks', 'provider-pack', 'payload.txt'), 'utf8')).toBe('staged bytes');
  });

  it.each(['publish', 'control-plane'] as const)('restores the live destination when %s fails after staging', async (fault) => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const before = capture(rootPath);
    const runner = new OperationRunner(createProviderInstallOperationAdapters({
      installers: successfulInstallers(),
      faults: { [fault]: () => { throw new Error(`${fault} failed`); } },
    }));

    const started = runner.start(request('install-curseforge', rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('rejects traversal destinations and cancellation before publish without changing live data', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const before = capture(rootPath);
    let cancel: (() => boolean) | undefined;
    const runner = new OperationRunner(createProviderInstallOperationAdapters({
      installers: successfulInstallers(() => { cancel?.(); }),
    }));

    const traversal = runner.start({ ...request('install-curseforge', rootPath), destinationId: '../escape' });
    await expect(runner.waitFor(traversal.id)).resolves.toMatchObject({ status: 'failed' });

    const started = runner.start(request('install-curseforge', rootPath));
    cancel = () => runner.cancel(started.id);
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'cancelled', result: { status: 'cancelled' } });
    expect(capture(rootPath)).toEqual(before);
    expect(fs.existsSync(path.join(rootPath, 'escape'))).toBe(false);
  });

  it('reapplies persisted provider metadata when recovering a published install', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const now = new Date().toISOString();
    new OperationJournal(rootPath).save({
      id: '11111111-1111-1111-1111-111111111111', kind: 'install-modrinth', rootPath, instanceId: 'provider-pack', status: 'running', phase: 'published',
      progress: { completed: 3, total: 4 }, createdAt: now, updatedAt: now,
      input: request('install-modrinth', rootPath),
      recovery: { destinationId: 'provider-pack', destinationName: 'Provider Pack', missing: [], metadata: { name: 'Recovered Provider', version: '9.9.9', source: 'modrinth' } },
    });
    const runner = new OperationRunner(createProviderInstallOperationAdapters({ installers: successfulInstallers() }));
    await runner.recover(rootPath);
    expect(JSON.parse(fs.readFileSync(path.join(rootPath, 'modpacks-metadata.json'), 'utf8'))).toMatchObject({
      modpacks: { 'provider-pack': { name: 'Recovered Provider', version: '9.9.9', source: 'modrinth' } },
    });
  });
});

function request(kind: 'install-curseforge' | 'install-modrinth', rootPath: string) {
  return kind === 'install-curseforge'
    ? { kind, rootPath, projectId: 1, fileId: 2, destinationId: 'provider-pack' } as const
    : { kind, rootPath, projectId: 'provider', versionId: 'version', destinationId: 'provider-pack' } as const;
}

function seedRoot(): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-provider-operation-'));
  fs.mkdirSync(path.join(rootPath, 'modpacks', 'provider-pack'), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'provider-pack', 'payload.txt'), 'original bytes');
  fs.writeFileSync(path.join(rootPath, 'modpacks', 'provider-pack', 'modpack.json'), JSON.stringify(config('provider-pack')));
  fs.writeFileSync(path.join(rootPath, 'modpacks.json'), JSON.stringify({ selectedModpack: 'provider-pack', modpacks: { 'provider-pack': { name: 'Original' } } }));
  fs.writeFileSync(path.join(rootPath, 'modpacks-metadata.json'), JSON.stringify({ selectedModpack: 'provider-pack', modpacks: {} }));
  return rootPath;
}

function capture(rootPath: string): Record<string, string> {
  return Object.fromEntries([
    'modpacks/provider-pack/payload.txt',
    'modpacks/provider-pack/modpack.json',
    'modpacks.json',
    'modpacks-metadata.json',
  ].map((file) => [file, fs.readFileSync(path.join(rootPath, file), 'utf8')]));
}

function failingInstallers(reason: string): ProviderInstallers {
  return {
    curseforge: async () => { throw new Error(reason); },
    modrinth: async () => { throw new Error(reason); },
  };
}

function optionalInstallers(): ProviderInstallers {
  return successfulInstallers(undefined, [{ path: 'mods/optional.jar', reason: 'download URL returned 404' }]);
}

function successfulInstallers(onUnit?: () => void, missing: Array<{ path: string; reason: string }> = []): ProviderInstallers {
  const install = async ({ rootPath, destinationId, checkCancelled }: { rootPath: string; destinationId: string; checkCancelled(): void }) => {
    checkCancelled();
    fs.mkdirSync(path.join(rootPath, 'modpacks', destinationId), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', destinationId, 'payload.txt'), 'staged bytes');
    fs.writeFileSync(path.join(rootPath, 'modpacks', destinationId, 'modpack.json'), JSON.stringify(config(destinationId)));
    onUnit?.();
    checkCancelled();
    return { config: config(destinationId), metadata: { id: destinationId, name: 'Provider Pack' }, missing };
  };
  return { curseforge: install, modrinth: install };
}

function config(id: string) {
  return {
    id,
    name: 'Provider Pack',
    runtime: { minecraft: '1.20.1', modLoader: { type: 'vanilla' as const } },
    memory: { maxMb: 4096 },
    vmOptions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}
