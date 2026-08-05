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
      exit: vi.fn(),
    },
  };
});

vi.mock('electron', () => ({ app: electron.app, BrowserWindow: { getAllWindows: () => [] } }));
import { registerLifecycleHandlers } from '../lifecycle';

describe('registerLifecycleHandlers', () => {
  beforeEach(() => { electron.handlers.clear(); vi.clearAllMocks(); });

  function terminationSignals() {
    let terminate: (() => void) | undefined;
    return {
      port: {
        once: vi.fn((_event: string, handler: () => void) => { terminate = handler; }),
        off: vi.fn(),
      },
      terminate: () => terminate?.(),
    };
  }

  it('prevents repeated quit until one asynchronous shutdown completes', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const shutdown = vi.fn(async () => await gate);
    const signals = terminationSignals();
    registerLifecycleHandlers({ createWindow: vi.fn(), shutdown, terminationSignals: signals.port as unknown as Pick<NodeJS.Process, 'once' | 'off'> });
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
    expect(electron.app.exit).toHaveBeenCalledWith(0);
    const finalEvent = { preventDefault: vi.fn() };
    beforeQuit(finalEvent);
    expect(finalEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('routes SIGTERM through the same asynchronous shutdown barrier', async () => {
    const signals = terminationSignals();
    const shutdown = vi.fn(async () => undefined);
    registerLifecycleHandlers({ createWindow: vi.fn(), shutdown, terminationSignals: signals.port as unknown as Pick<NodeJS.Process, 'once' | 'off'> });

    signals.terminate();
    expect(electron.app.quit).toHaveBeenCalledOnce();
    const beforeQuit = electron.handlers.get('before-quit')![0];
    beforeQuit({ preventDefault: vi.fn() });
    await new Promise((resolve) => setImmediate(resolve));
    expect(shutdown).toHaveBeenCalledOnce();
    expect(electron.app.quit).toHaveBeenCalledOnce();
    expect(electron.app.exit).toHaveBeenCalledWith(0);

    electron.handlers.get('quit')![0]();
    expect(signals.port.off).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
  });
});
