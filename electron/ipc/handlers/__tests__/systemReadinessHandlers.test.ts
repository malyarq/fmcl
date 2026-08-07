import { afterEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_READINESS_CHANNELS } from '../../../../shared/contracts/systemReadiness';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (channel: string) => mocked.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
}));

import { registerSystemReadinessHandlers } from '../systemReadinessHandlers';

describe('system readiness IPC handler', () => {
  afterEach(() => {
    mocked.handlers.clear();
    vi.restoreAllMocks();
  });

  it('returns the injected bounded report for an empty request', async () => {
    const report = {
      overall: 'ready' as const,
      checks: [{ id: 'storage' as const, status: 'ready' as const, code: 'ready' as const }],
    };
    const check = vi.fn().mockResolvedValue(report);
    registerSystemReadinessHandlers(check);

    const handler = mocked.handlers.get(SYSTEM_READINESS_CHANNELS.check);
    await expect(handler?.({}, {})).resolves.toEqual(report);
    expect(check).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, [], { rootPath: '/private/game' }, { includePaths: true }])(
    'rejects forged input before probing the system: %j',
    async (request) => {
      const check = vi.fn();
      registerSystemReadinessHandlers(check);
      const handler = mocked.handlers.get(SYSTEM_READINESS_CHANNELS.check);

      await expect(handler?.({}, request)).rejects.toThrow(/must be an empty object/i);
      expect(check).not.toHaveBeenCalled();
    },
  );
});
