import { describe, expect, it, vi } from 'vitest';
import { INSTANCE_CHANNELS } from '../../../../shared/contracts/instances';
import { createInstancesHandlers } from '../instancesHandlers';
import type { LauncherRoot } from '../../../domains/instances/instanceTypes';
import {
  validateInstanceConfig,
  validateInstanceConfigRequest,
  validateInstanceCreateRequest,
  validateInstanceListRequest,
  validateInstanceMetadataRequest,
  validateInstancePrepareRequest,
  validateInstanceRenameRequest,
  validateInstanceSelectRequest,
  validateInstanceSnapshotRequest,
} from '../../validation/privilegedPayloads';

describe('instances control-plane request validation', () => {
  it('defines only the dedicated semantic channels', () => {
    expect(Object.values(INSTANCE_CHANNELS)).toEqual([
      'instances:list',
      'instances:snapshot',
      'instances:select',
      'instances:create',
      'instances:rename',
      'instances:config',
      'instances:metadata',
      'instances:prepare',
    ]);
  });

  it('accepts serializable command DTOs without filesystem authority', () => {
    const config = { runtime: { minecraftVersion: '1.21.1' }, memory: { maxMb: 4096 }, game: { useOptiFine: true } };
    expect(validateInstanceListRequest({})).toEqual({});
    expect(validateInstanceSnapshotRequest({ id: 'alpha' })).toEqual({ id: 'alpha' });
    expect(validateInstanceSelectRequest({ id: 'alpha' })).toEqual({ id: 'alpha' });
    expect(validateInstanceCreateRequest({ name: 'Alpha', source: { source: 'local' }, config })).toMatchObject({ name: 'Alpha' });
    expect(validateInstanceRenameRequest({ id: 'alpha', name: 'Renamed' })).toEqual({ id: 'alpha', name: 'Renamed' });
    expect(validateInstanceConfigRequest({ action: 'get', id: 'alpha' })).toEqual({ action: 'get', id: 'alpha' });
    expect(validateInstanceConfigRequest({ action: 'save', id: 'alpha', config })).toMatchObject({ action: 'save' });
    expect(validateInstanceMetadataRequest({ id: 'alpha' })).toEqual({ id: 'alpha' });
    expect(validateInstancePrepareRequest({})).toEqual({});
  });

  it.each([
    () => validateInstanceSnapshotRequest({ root: '/private/root' }),
    () => validateInstanceSelectRequest({ rootPath: '/private/root', id: 'alpha' }),
    () => validateInstanceSnapshotRequest({ id: '../escape' }),
    () => validateInstanceSnapshotRequest({ id: 'C:\\private\\root' }),
    () => validateInstanceConfig({ runtime: { minecraftVersion: '1.21.1' }, java: { executable: '/private/java' } }),
    () => validateInstanceConfig({ runtime: { minecraftVersion: '1.21.1' }, vmOptions: ['-Djava.home=/private/java'] }),
  ])('rejects unknown, path-shaped, traversal and forged-root input', (validate) => {
    expect(validate).toThrow(/instance|filesystem/i);
  });
});

const root = {} as LauncherRoot;

const readySnapshot = {
  selectedId: 'alpha',
  records: [{
    id: 'alpha',
    name: 'Alpha',
    source: {
      source: 'local' as const,
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    },
    config: {
      runtime: { minecraftVersion: '1.21.1' },
      memory: { maxMb: 4096 },
      game: { useOptiFine: true },
    },
    summary: { minecraftVersion: '1.21.1' },
  }],
};

function createApplication() {
  return {
    read: async () => ({ status: 'ready' as const, snapshot: readySnapshot }),
    execute: async () => ({ status: 'committed' as const, snapshot: readySnapshot }),
  };
}

describe('instances control-plane handler factory', () => {
  it('dispatches each validated command through the injected application and main-owned root', async () => {
    const application = createApplication();
    const read = vi.fn(application.read);
    const execute = vi.fn(application.execute);
    const handlers = createInstancesHandlers({ application: { read, execute } as never, getDefaultInstanceRoot: async () => root });

    await expect(handlers[INSTANCE_CHANNELS.list]({})).resolves.toEqual({
      ok: true,
      value: { status: 'ready', instances: [{ id: 'alpha', name: 'Alpha', selected: true, summary: { minecraftVersion: '1.21.1' } }] },
    });
    await handlers[INSTANCE_CHANNELS.snapshot]({ id: 'alpha' });
    await handlers[INSTANCE_CHANNELS.select]({ id: 'alpha' });
    await handlers[INSTANCE_CHANNELS.create]({ name: 'Created', source: { source: 'local' }, config: { runtime: { minecraftVersion: '1.21.1' }, memory: { maxMb: 4096 }, game: { useOptiFine: true } } });
    await handlers[INSTANCE_CHANNELS.rename]({ id: 'alpha', name: 'Renamed' });
    await expect(handlers[INSTANCE_CHANNELS.config]({ action: 'get', id: 'alpha' })).resolves.toMatchObject({
      ok: true,
      value: { game: { useOptiFine: true } },
    });
    await handlers[INSTANCE_CHANNELS.config]({ action: 'save', id: 'alpha', config: { runtime: { minecraftVersion: '1.21.1' }, memory: { maxMb: 4096 } } });
    await handlers[INSTANCE_CHANNELS.metadata]({ id: 'alpha' });
    await handlers[INSTANCE_CHANNELS.prepare]({});

    expect(read).toHaveBeenCalledTimes(5);
    expect(execute).toHaveBeenCalledWith(root, expect.objectContaining({ type: 'select', id: 'alpha' }));
    expect(execute).toHaveBeenCalledWith(root, expect.objectContaining({
      type: 'create',
      name: 'Created',
      config: expect.objectContaining({ game: { useOptiFine: true } }),
    }));
    expect(execute).toHaveBeenCalledWith(root, expect.objectContaining({ type: 'rename', name: 'Renamed' }));
    expect(execute).toHaveBeenCalledWith(root, expect.objectContaining({ type: 'save-config', id: 'alpha' }));
  });

  it('rejects invalid input before an application call and maps native failures safely', async () => {
    const read = vi.fn(async () => ({ status: 'ready' as const, snapshot: readySnapshot }));
    const execute = vi.fn();
    const handlers = createInstancesHandlers({ application: { read, execute } as never, getDefaultInstanceRoot: async () => root });

    await expect(handlers[INSTANCE_CHANNELS.snapshot]({ id: '../escape' })).rejects.toThrow(/instance snapshot/i);
    expect(read).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();

    read.mockRejectedValueOnce(new Error('ENOENT: /private/root/instance-control-plane.json'));
    const result = await handlers[INSTANCE_CHANNELS.list]({});
    expect(result).toEqual({ ok: false, error: { code: 'INSTANCE_UNAVAILABLE', message: 'Instance state is unavailable.' } });
    expect(JSON.stringify(result)).not.toContain('/private/root');
  });

  it('does not return a native Java executable from canonical state', async () => {
    const snapshot = {
      ...readySnapshot,
      records: [{
        ...readySnapshot.records[0],
        config: { ...readySnapshot.records[0].config, java: { executable: '/private/java' } },
      }],
    };
    const handlers = createInstancesHandlers({
      application: { read: async () => ({ status: 'ready' as const, snapshot }), execute: async () => ({ status: 'committed' as const, snapshot }) } as never,
      getDefaultInstanceRoot: async () => root,
    });

    const result = await handlers[INSTANCE_CHANNELS.snapshot]({ id: 'alpha' });
    expect(result).toMatchObject({ ok: true, value: { config: { runtime: { minecraftVersion: '1.21.1' } } } });
    expect(JSON.stringify(result)).not.toContain('/private/java');
  });
});
