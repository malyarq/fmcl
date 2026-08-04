import { describe, expect, it, vi } from 'vitest';
import { ApplicationLifecycle } from '../applicationLifecycle';

describe('ApplicationLifecycle', () => {
  it('unregisters admission, awaits composition, then stops auth and tray once', async () => {
    const order: string[] = [];
    const lifecycle = new ApplicationLifecycle({
      unregisterIpc: () => { order.push('ipc'); },
      shutdownComposition: async () => { order.push('composition'); return { failures: [] }; },
      stopAuthServer: async () => { order.push('auth'); },
      destroyTray: () => { order.push('tray'); },
    });
    expect(lifecycle.shutdown()).toBe(lifecycle.shutdown());
    await expect(lifecycle.shutdown()).resolves.toEqual({ composition: { failures: [] }, failures: [] });
    expect(order).toEqual(['ipc', 'composition', 'auth', 'tray']);
  });

  it('continues independent cleanup and reports failures', async () => {
    const destroyTray = vi.fn();
    const lifecycle = new ApplicationLifecycle({
      unregisterIpc: () => { throw new Error('ipc failure'); },
      shutdownComposition: async () => { throw new Error('composition failure'); },
      stopAuthServer: async () => { throw new Error('auth failure'); },
      destroyTray,
    });
    const report = await lifecycle.shutdown();
    expect(report.failures.map((failure) => failure.owner)).toEqual(['ipc', 'auth-server']);
    expect(report.composition.failures).toEqual([{ owner: 'operations', message: 'composition failure' }]);
    expect(destroyTray).toHaveBeenCalledOnce();
  });
});

