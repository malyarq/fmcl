import { afterEach, describe, expect, it, vi } from 'vitest';
import { networkIPC } from '../networkIPC';

describe('networkIPC', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('delegates to three focused preload capabilities', async () => {
    const tunnelState = { revision: 1, state: 'active', role: 'host', peerCount: 0 };
    const network = {
      tunnel: { getState: vi.fn(async () => tunnelState), host: vi.fn(async () => tunnelState), join: vi.fn(), stop: vi.fn(), onState: vi.fn(() => vi.fn()) },
      lan: { getState: vi.fn(), start: vi.fn(), stop: vi.fn(), broadcast: vi.fn(), ping: vi.fn(), onState: vi.fn(), onDiscover: vi.fn() },
      upnp: { getState: vi.fn(), mapTcp: vi.fn(), unmapTcp: vi.fn(), stop: vi.fn(), onState: vi.fn() },
    };
    vi.stubGlobal('window', { api: { network } });
    await expect(networkIPC.tunnel.host({ port: 25_565 })).resolves.toBe(tunnelState);
    expect(network.tunnel.host).toHaveBeenCalledWith({ port: 25_565 });
    expect(networkIPC.tunnel.onState(vi.fn())).toEqual(expect.any(Function));
  });

  it('does not invent a fallback API outside Electron', async () => {
    vi.stubGlobal('window', undefined);
    expect(networkIPC.isAvailable()).toBe(false);
    await expect(networkIPC.tunnel.getState()).rejects.toThrow(/network API is not available/i);
  });
});

