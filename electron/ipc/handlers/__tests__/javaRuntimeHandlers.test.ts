import { afterEach, describe, expect, it, vi } from 'vitest';
import { JAVA_RUNTIME_CHANNELS } from '../../../../shared/contracts/javaRuntime';
import type { LauncherRoot } from '../../../domains/instances/instanceTypes';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (channel: string) => mocked.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
}));

import { registerJavaRuntimeHandlers } from '../javaRuntimeHandlers';

const rootA = {} as LauncherRoot;
const rootB = {} as LauncherRoot;

function selectedState() {
  return {
    status: 'ready' as const,
    snapshot: {
      selectedId: 'alpha',
      records: [{
        id: 'alpha',
        name: 'Alpha',
        source: { source: 'local' as const, createdAt: '2026-08-04T00:00:00.000Z', updatedAt: '2026-08-04T00:00:00.000Z' },
        config: { runtime: { minecraftVersion: '1.21.1' }, memory: { maxMb: 4096 } },
        summary: { minecraftVersion: '1.21.1' },
      }],
    },
  };
}

function createDependencies() {
  return {
    application: {
      read: vi.fn(async () => selectedState()),
      execute: vi.fn(async () => ({ status: 'committed' as const, snapshot: selectedState().snapshot })),
    },
    getDefaultInstanceRoot: vi.fn(async () => rootA),
    scanJava: vi.fn(async () => [{
      path: '/private/java/bin/java',
      version: '21.0.6',
      majorVersion: 21,
      valid: true,
      arch: 'x64',
    }]),
    createInstallationId: vi.fn(() => 'installation-1'),
  };
}

describe('java runtime IPC handlers', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.restoreAllMocks();
  });

  it('scans into bounded opaque IDs and saves selection through the canonical application', async () => {
    const deps = createDependencies();
    registerJavaRuntimeHandlers(deps as never);
    const scan = mocked.handlers.get(JAVA_RUNTIME_CHANNELS.scan);
    const select = mocked.handlers.get(JAVA_RUNTIME_CHANNELS.select);

    const installations = await scan?.({}, {});
    expect(installations).toEqual([{ id: 'installation-1', version: '21.0.6', majorVersion: 21, arch: 'x64' }]);
    expect(JSON.stringify(installations)).not.toContain('/private/java');

    await expect(select?.({}, { installationId: 'installation-1' })).resolves.toEqual({ status: 'selected' });
    expect(deps.application.execute).toHaveBeenCalledWith(rootA, {
      version: 1,
      type: 'save-config',
      id: 'alpha',
      config: {
        runtime: { minecraftVersion: '1.21.1' },
        memory: { maxMb: 4096 },
        java: { executable: '/private/java/bin/java' },
      },
    });
  });

  it('retains at most 64 valid installations from one scan', async () => {
    const deps = createDependencies();
    let index = 0;
    deps.createInstallationId.mockImplementation(() => `installation-${index++}`);
    deps.scanJava.mockResolvedValue(Array.from({ length: 65 }, (_, majorVersion) => ({
      path: `/private/java/${majorVersion}`,
      version: `${majorVersion}.0.0`,
      majorVersion: majorVersion + 1,
      valid: true,
      arch: 'x64',
    })));
    registerJavaRuntimeHandlers(deps as never);
    const scan = mocked.handlers.get(JAVA_RUNTIME_CHANNELS.scan);

    await expect(scan?.({}, {})).resolves.toHaveLength(64);
  });

  it('rejects forged payloads, stale scan IDs, and IDs issued for another root before config mutation', async () => {
    const deps = createDependencies();
    deps.createInstallationId
      .mockReturnValueOnce('first')
      .mockReturnValueOnce('second')
      .mockReturnValueOnce('cross-root');
    registerJavaRuntimeHandlers(deps as never);
    const scan = mocked.handlers.get(JAVA_RUNTIME_CHANNELS.scan);
    const select = mocked.handlers.get(JAVA_RUNTIME_CHANNELS.select);

    await expect(select?.({}, { installationId: 'forged', rootPath: '/private/root' })).rejects.toThrow(/Java runtime selection/i);
    await expect(scan?.({}, {})).resolves.toEqual(expect.any(Array));
    await expect(scan?.({}, {})).resolves.toEqual(expect.any(Array));
    await expect(select?.({}, { installationId: 'first' })).rejects.toThrow(/scan again/i);

    deps.getDefaultInstanceRoot.mockResolvedValueOnce(rootB);
    await expect(scan?.({}, {})).resolves.toEqual(expect.any(Array));
    deps.getDefaultInstanceRoot.mockResolvedValueOnce(rootA);
    await expect(select?.({}, { installationId: 'cross-root' })).rejects.toThrow(/scan again/i);
    expect(deps.application.read).not.toHaveBeenCalled();
    expect(deps.application.execute).not.toHaveBeenCalled();
  });
});
