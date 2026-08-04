import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { InstanceApplication } from '../instanceApplication';
import type {
  CanonicalInstanceRecord,
  CanonicalInstanceSnapshot,
  InstanceControlPlaneRead,
  InstanceEditableConfig,
  LauncherRoot,
} from '../instanceTypes';
import type { InstanceApplicationPorts } from '../ports';

function createRoot(): LauncherRoot {
  return {} as LauncherRoot;
}

function createPorts(initialRead: InstanceControlPlaneRead): InstanceApplicationPorts {
  let currentRead = initialRead;

  return {
    controlPlane: {
      read: vi.fn(async () => currentRead),
      commit: vi.fn(async (_root, snapshot) => {
        currentRead = { status: 'ready', snapshot };
      }),
    },
    clock: {
      now: () => '2026-08-04T00:00:00.000Z',
    },
    ids: {
      next: () => 'generated-id',
    },
  };
}

const config: InstanceEditableConfig = {
  runtime: {
    minecraftVersion: '1.21.1',
    modLoader: { type: 'fabric', version: '0.16.0' },
  },
  memory: { maxMb: 4096 },
};

function createRecord(id = 'pack-one'): CanonicalInstanceRecord {
  return {
    id,
    name: 'Pack One',
    source: {
      source: 'modrinth',
      sourceId: 'project-one',
      sourceVersionId: 'version-one',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    },
    config,
    summary: {
      minecraftVersion: '1.21.1',
      modLoader: { type: 'fabric', version: '0.16.0' },
    },
  };
}

function ready(snapshot: CanonicalInstanceSnapshot): InstanceControlPlaneRead {
  return { status: 'ready', snapshot };
}

describe('InstanceApplication', () => {
  it('reports an absent canonical document as uninitialized without committing a write', async () => {
    const ports = createPorts({ status: 'uninitialized' });
    const application = new InstanceApplication(ports);

    await expect(application.read(createRoot())).resolves.toEqual({ status: 'uninitialized' });
    expect(ports.controlPlane.read).toHaveBeenCalledTimes(1);
    expect(ports.controlPlane.commit).not.toHaveBeenCalled();
  });

  it('keeps launcher-root authority opaque to serializable DTOs', () => {
    expectTypeOf<LauncherRoot>().not.toMatchTypeOf<{ rootPath: string }>();
    expectTypeOf<CanonicalInstanceSnapshot>().toMatchTypeOf<{
      selectedId: string | null;
      records: readonly unknown[];
    }>();
  });

  it('creates a canonical record and selects it when the snapshot is empty', async () => {
    const ports = createPorts(ready({ selectedId: null, records: [] }));
    const application = new InstanceApplication(ports);

    const result = await application.execute(createRoot(), {
      version: 1,
      type: 'create',
      name: 'New Pack',
      source: { source: 'local' },
      config,
    });

    expect(result).toMatchObject({
      status: 'committed',
      snapshot: {
        selectedId: 'generated-id',
        records: [{ id: 'generated-id', name: 'New Pack' }],
      },
    });
    expect(Object.isFrozen(result.snapshot)).toBe(true);
    expect(Object.isFrozen(result.snapshot.records[0])).toBe(true);
    expect(ports.controlPlane.commit).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate ids and a dangling selection before it commits', async () => {
    const duplicate = createRecord();
    const ports = createPorts(ready({
      selectedId: 'missing',
      records: [duplicate, duplicate],
    }));
    const application = new InstanceApplication(ports);

    await expect(application.execute(createRoot(), {
      version: 1,
      type: 'select',
      id: duplicate.id,
    })).rejects.toThrow(/duplicate instance id|selected id/i);
    expect(ports.controlPlane.commit).not.toHaveBeenCalled();
  });

  it('rejects a published record whose summary disagrees with its editable config', async () => {
    const ports = createPorts(ready({ selectedId: null, records: [] }));
    const application = new InstanceApplication(ports);
    const contradictory = {
      ...createRecord(),
      summary: { minecraftVersion: '1.20.1' },
    };

    await expect(application.execute(createRoot(), {
      version: 1,
      type: 'commit-published',
      record: contradictory,
    })).rejects.toThrow(/summary.*config/i);
    expect(ports.controlPlane.commit).not.toHaveBeenCalled();
  });

  it('rejects unsupported command versions before it commits', async () => {
    const ports = createPorts(ready({ selectedId: null, records: [] }));
    const application = new InstanceApplication(ports);

    await expect(application.execute(createRoot(), {
      version: 2,
      type: 'delete',
      id: 'pack-one',
    })).rejects.toThrow(/unsupported.*version/i);
    expect(ports.controlPlane.commit).not.toHaveBeenCalled();
  });

  it('updates one complete snapshot through rename, selection, config save, and reconciliation', async () => {
    const first = createRecord('pack-one');
    const second = createRecord('pack-two');
    const ports = createPorts(ready({ selectedId: first.id, records: [first] }));
    const application = new InstanceApplication(ports);
    const root = createRoot();

    await application.execute(root, { version: 1, type: 'commit-published', record: second, select: false });
    await application.execute(root, { version: 1, type: 'select', id: second.id });
    await application.execute(root, { version: 1, type: 'rename', id: second.id, name: 'Renamed Pack' });
    const saved = await application.execute(root, {
      version: 1,
      type: 'save-config',
      id: second.id,
      config: {
        ...config,
        runtime: { minecraftVersion: '1.21.2', modLoader: { type: 'neoforge', version: '21.2.0' } },
      },
    });
    const reconciledRecord = {
      ...saved.snapshot.records.find((record) => record.id === second.id)!,
      source: {
        ...saved.snapshot.records.find((record) => record.id === second.id)!.source,
        sourceVersionId: 'version-two',
      },
    };
    const reconciled = await application.execute(root, {
      version: 1,
      type: 'reconcile-update',
      record: reconciledRecord,
    });

    expect(reconciled).toMatchObject({
      status: 'committed',
      snapshot: {
        selectedId: second.id,
        records: [
          { id: first.id },
          {
            id: second.id,
            name: 'Renamed Pack',
            source: { sourceVersionId: 'version-two' },
            summary: { minecraftVersion: '1.21.2', modLoader: { type: 'neoforge', version: '21.2.0' } },
          },
        ],
      },
    });
    expect(ports.controlPlane.commit).toHaveBeenCalledTimes(5);
  });

  it('makes repeated published and delete commands no-ops with the same canonical result', async () => {
    const record = createRecord();
    const ports = createPorts(ready({ selectedId: null, records: [] }));
    const application = new InstanceApplication(ports);
    const root = createRoot();

    const published = await application.execute(root, {
      version: 1,
      type: 'commit-published',
      record,
    });
    const repeatedPublish = await application.execute(root, {
      version: 1,
      type: 'commit-published',
      record,
    });
    const deleted = await application.execute(root, { version: 1, type: 'delete', id: record.id });
    const repeatedDelete = await application.execute(root, { version: 1, type: 'delete', id: record.id });

    expect(published.status).toBe('committed');
    expect(repeatedPublish).toEqual({ status: 'noop', snapshot: published.snapshot });
    expect(deleted).toEqual({ status: 'committed', snapshot: { selectedId: null, records: [] } });
    expect(repeatedDelete).toEqual({ status: 'noop', snapshot: deleted.snapshot });
    expect(ports.controlPlane.commit).toHaveBeenCalledTimes(2);
  });
});
