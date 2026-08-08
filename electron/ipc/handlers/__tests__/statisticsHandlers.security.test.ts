import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
      mocked.handlers.set(channel, handler);
    },
  },
}));

import { registerStatisticsHandlers } from '../statisticsHandlers';
import {
  authorizeSavePath,
  clearSavePathAuthorizationsForTests,
} from '../../../security/savePathAuthorizations';

describe('statistics export authorization', () => {
  afterEach(() => {
    mocked.handlers.clear();
    clearSavePathAuthorizationsForTests();
    vi.restoreAllMocks();
  });

  it('requires a one-time path authorization owned by the calling renderer', async () => {
    const outputPath = path.join(os.tmpdir(), 'burrow-statistics.json');
    const exportStats = vi.fn().mockReturnValue({ filePath: outputPath });
    registerStatisticsHandlers({ statisticsService: { exportStats, getStats: vi.fn() } as never });
    const handler = mocked.handlers.get('stats:export');
    const ownerEvent = { sender: { id: 7 } };

    authorizeSavePath(7, outputPath);
    await expect(handler?.({ sender: { id: 8 } }, outputPath)).rejects.toThrow(/not authorized/);
    await expect(handler?.(ownerEvent, outputPath)).resolves.toEqual({ filePath: outputPath });
    await expect(handler?.(ownerEvent, outputPath)).rejects.toThrow(/not authorized/);
    expect(exportStats).toHaveBeenCalledOnce();
  });
});
