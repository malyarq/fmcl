import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createProviderInstallOperationAdapters, type ProviderInstallers } from '../providerInstallOperation';
import { OperationRunner } from '../operationRunner';
import { OperationJournal } from '../operationJournal';
import type { InstanceCommand, InstanceCommandResult } from '../../../domains/instances/instanceTypes';

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
    const runner = canonicalRunner(createProviderInstallOperationAdapters({
      installers: failingInstallers(reason),
    }));

    const started = runner.start(request(kind, rootPath));

    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'failed', result: { status: 'failed' } });
    expect(capture(rootPath)).toEqual(before);
  });

  it('reports only declared optional misses with their exact path and reason after publish', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const runner = canonicalRunner(createProviderInstallOperationAdapters({ installers: optionalInstallers() }));

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
    const runner = canonicalRunner(createProviderInstallOperationAdapters({
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
    const runner = canonicalRunner(createProviderInstallOperationAdapters({
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

  it('fails closed for published legacy provider recovery data without a canonical command', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const now = new Date().toISOString();
    new OperationJournal(rootPath).save({
      id: '11111111-1111-1111-1111-111111111111', kind: 'install-modrinth', rootPath, instanceId: 'provider-pack', status: 'running', phase: 'published',
      progress: { completed: 3, total: 4 }, createdAt: now, updatedAt: now,
      input: request('install-modrinth', rootPath),
      recovery: { destinationId: 'provider-pack', destinationName: 'Provider Pack', missing: [], metadata: { name: 'Recovered Provider', version: '9.9.9', source: 'modrinth' } },
    });
    const runner = canonicalRunner(createProviderInstallOperationAdapters({ installers: successfulInstallers() }));
    await runner.recover(rootPath);
    expect(new OperationJournal(rootPath).get('11111111-1111-1111-1111-111111111111')).toMatchObject({ status: 'recovery-required' });
  });

  it.each(['install-curseforge', 'install-modrinth'] as const)('records the complete %s command before publish and commits only through the supplied scope', async (kind) => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const commands: InstanceCommand[] = [];
    const runner = canonicalRunner(createProviderInstallOperationAdapters({ installers: successfulInstallers() }), (command) => {
      commands.push(command);
      return { status: 'committed' as const, snapshot: snapshot(command) };
    });

    const started = runner.start(request(kind, rootPath));
    await expect(runner.waitFor(started.id)).resolves.toMatchObject({ status: 'succeeded', result: { instanceId: 'provider-pack' } });
    const durable = new OperationJournal(rootPath).get(started.id)?.recovery?.canonicalCommand;
    expect(durable?.command).toMatchObject({ type: 'commit-published', record: { id: 'provider-pack', source: { source: kind === 'install-curseforge' ? 'curseforge' : 'modrinth' } }, select: true });
    expect(commands).toEqual([durable?.command]);
    expect(fs.existsSync(path.join(rootPath, 'modpacks.json'))).toBe(true);
    expect(fs.existsSync(path.join(rootPath, 'modpacks-metadata.json'))).toBe(true);
  });

  it('replays a published provider command exactly once after a crash and accepts an idempotent no-op', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const command = providerCommand('modrinth');
    const now = new Date().toISOString();
    new OperationJournal(rootPath).save({
      id: '22222222-2222-2222-2222-222222222222', kind: 'install-modrinth', rootPath, instanceId: 'provider-pack', status: 'running', phase: 'published',
      progress: { completed: 3, total: 4 }, createdAt: now, updatedAt: now, input: request('install-modrinth', rootPath),
      recovery: { destinationId: 'provider-pack', destinationName: 'Provider Pack', missing: [], canonicalCommand: { version: 1, rootPath, operationId: '22222222-2222-2222-2222-222222222222', command } },
    });
    const commands: InstanceCommand[] = [];
    const runner = canonicalRunner(createProviderInstallOperationAdapters({ installers: successfulInstallers() }), (received) => {
      commands.push(received);
      return { status: 'noop' as const, snapshot: snapshot(received) };
    });

    await runner.recover(rootPath);
    expect(commands).toEqual([command]);
    expect(new OperationJournal(rootPath).get('22222222-2222-2222-2222-222222222222')).toMatchObject({ status: 'recovered', result: { status: 'recovered', instanceId: 'provider-pack' } });
  });

  it('serializes provider installs for the same root', async () => {
    const rootPath = seedRoot();
    tempDirs.push(rootPath);
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstEntered = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let continueFirst: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { continueFirst = resolve; });
    const installers: ProviderInstallers = {
      curseforge: async (input) => { events.push('curseforge:start'); releaseFirst?.(); await blocked; events.push('curseforge:end'); return stage(input.rootPath, input.destinationId, 'curseforge'); },
      modrinth: async (input) => { events.push('modrinth:start'); return stage(input.rootPath, input.destinationId, 'modrinth'); },
    };
    const runner = canonicalRunner(createProviderInstallOperationAdapters({ installers }));
    const first = runner.start({ ...request('install-curseforge', rootPath), destinationId: 'first-pack' });
    const second = runner.start({ ...request('install-modrinth', rootPath), destinationId: 'second-pack' });
    await firstEntered;
    expect(events).toEqual(['curseforge:start']);
    continueFirst?.();
    await expect(Promise.all([runner.waitFor(first.id), runner.waitFor(second.id)])).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ status: 'succeeded' }), expect.objectContaining({ status: 'succeeded' })]));
    expect(events).toEqual(['curseforge:start', 'curseforge:end', 'modrinth:start']);
  });
});

function request(kind: 'install-curseforge' | 'install-modrinth', rootPath: string) {
  return kind === 'install-curseforge'
    ? { kind, rootPath, projectId: 1, fileId: 2, destinationId: 'provider-pack' } as const
    : { kind, rootPath, projectId: 'provider', versionId: 'version', destinationId: 'provider-pack' } as const;
}

function seedRoot(): string {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-provider-operation-'));
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
  const install = (source: 'curseforge' | 'modrinth') => async ({ rootPath, destinationId, checkCancelled }: { rootPath: string; destinationId: string; checkCancelled(): void }) => {
    checkCancelled();
    fs.mkdirSync(path.join(rootPath, 'modpacks', destinationId), { recursive: true });
    fs.writeFileSync(path.join(rootPath, 'modpacks', destinationId, 'payload.txt'), 'staged bytes');
    fs.writeFileSync(path.join(rootPath, 'modpacks', destinationId, 'modpack.json'), JSON.stringify(config(destinationId)));
    onUnit?.();
    checkCancelled();
    return { config: config(destinationId), source: { source, sourceId: 'provider', sourceVersionId: 'version' }, content: { instanceId: destinationId, descriptor: source === 'curseforge' ? 'manifest.json' as const : 'modrinth.index.json' as const }, missing };
  };
  return { curseforge: install('curseforge'), modrinth: install('modrinth') };
}

function stage(rootPath: string, destinationId: string, source: 'curseforge' | 'modrinth') {
  fs.mkdirSync(path.join(rootPath, 'modpacks', destinationId), { recursive: true });
  fs.writeFileSync(path.join(rootPath, 'modpacks', destinationId, 'payload.txt'), 'staged bytes');
  fs.writeFileSync(path.join(rootPath, 'modpacks', destinationId, 'modpack.json'), JSON.stringify(config(destinationId)));
  return { config: config(destinationId), source: { source, sourceId: 'provider', sourceVersionId: 'version' }, content: { instanceId: destinationId, descriptor: source === 'curseforge' ? 'manifest.json' as const : 'modrinth.index.json' as const }, missing: [] };
}

function canonicalRunner(adapters: ReturnType<typeof createProviderInstallOperationAdapters>, execute?: (command: InstanceCommand) => InstanceCommandResult): OperationRunner {
  return new OperationRunner(adapters, {
    rootMutationCoordinator: {
      forRoot: () => ({
        read: async () => ({ status: 'ready' as const, snapshot: { selectedId: 'provider-pack', records: [record()] } }),
        prepare: async () => ({ status: 'ready' as const, source: 'canonical' as const, snapshot: { selectedId: 'provider-pack', records: [record()] } }),
        execute: async (command: InstanceCommand) => execute?.(command) ?? committed(command),
      }),
    },
  });
}

function committed(command: InstanceCommand) {
  return { status: 'committed' as const, snapshot: snapshot(command) };
}

function snapshot(command: InstanceCommand) {
  return command.type === 'commit-published' ? { selectedId: command.record.id, records: [command.record] } : { selectedId: 'provider-pack', records: [record()] };
}

function providerCommand(source: 'curseforge' | 'modrinth'): InstanceCommand {
  return {
    version: 1, type: 'commit-published', select: true,
    record: { ...record(), source: { source, sourceId: 'provider', sourceVersionId: 'version', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } },
  };
}

function record() {
  return { id: 'provider-pack', name: 'Original', source: { source: 'local' as const, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }, config: { runtime: { minecraftVersion: '1.20.1' } }, summary: { minecraftVersion: '1.20.1' } };
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
