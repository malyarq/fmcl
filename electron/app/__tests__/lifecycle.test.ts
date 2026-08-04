import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  return {
    handlers,
    app: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const current = handlers.get(event) ?? []; current.push(handler); handlers.set(event, current);
      }),
      quit: vi.fn(),
    },
  };
});

vi.mock('electron', () => ({ app: electron.app, BrowserWindow: { getAllWindows: () => [] } }));
import { registerLifecycleHandlers } from '../lifecycle';

describe('registerLifecycleHandlers', () => {
  beforeEach(() => { electron.handlers.clear(); vi.clearAllMocks(); });

  it('prevents repeated quit until one asynchronous shutdown completes', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const shutdown = vi.fn(async () => await gate);
    registerLifecycleHandlers({ createWindow: vi.fn(), shutdown });
    const beforeQuit = electron.handlers.get('before-quit')![0];
    const first = { preventDefault: vi.fn() };
    const second = { preventDefault: vi.fn() };
    beforeQuit(first); beforeQuit(second);
    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(second.preventDefault).toHaveBeenCalledOnce();
    expect(shutdown).toHaveBeenCalledOnce();
    expect(electron.app.quit).not.toHaveBeenCalled();
    release?.();
    await gate;
    await new Promise((resolve) => setImmediate(resolve));
    expect(electron.app.quit).toHaveBeenCalledOnce();
    const finalEvent = { preventDefault: vi.fn() };
    beforeQuit(finalEvent);
    expect(finalEvent.preventDefault).not.toHaveBeenCalled();
  });
});
