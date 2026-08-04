import { afterEach, describe, expect, it, vi } from 'vitest';
import { operationsIPC } from '../operationsIPC';

describe('operationsIPC', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates typed calls to the sole window.api operations capability', async () => {
    const unsubscribe = vi.fn();
    const operations = {
      start: vi.fn().mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', kind: 'duplicate', status: 'queued' }),
      get: vi.fn().mockResolvedValue(undefined),
      listRecovered: vi.fn().mockResolvedValue([]),
      cancel: vi.fn().mockResolvedValue({ cancelled: false }),
      subscribe: vi.fn().mockResolvedValue(unsubscribe),
    };
    vi.stubGlobal('window', { api: { operations } });

    await expect(operationsIPC.start({ kind: 'duplicate', sourceId: 'source-pack' })).resolves.toMatchObject({ id: '11111111-1111-1111-1111-111111111111' });
    await expect(operationsIPC.start({ kind: 'import', archiveRef: 'archive-ref' })).resolves.toMatchObject({ id: '11111111-1111-1111-1111-111111111111' });
    await expect(operationsIPC.start({ kind: 'export', instanceId: 'alpha', format: 'zip', outputPath: '/exports/alpha.zip' })).resolves.toMatchObject({ id: '11111111-1111-1111-1111-111111111111' });
    await expect(operationsIPC.subscribe('11111111-1111-1111-1111-111111111111', vi.fn())).resolves.toBe(unsubscribe);
    expect(operations.start).toHaveBeenCalledWith({ kind: 'import', archiveRef: 'archive-ref' });
    expect(operations.subscribe).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', expect.any(Function));
  });
});
