import { afterEach, describe, expect, it, vi } from 'vitest';
import { NETWORK_CHANNELS } from '../../../../shared/contracts/network';

const electron = vi.hoisted(() => ({ handlers: new Map<string, (...args: unknown[]) => unknown>() }));
vi.mock('electron', () => ({
  ipcMain: {
    removeHandler: (channel: string) => electron.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => electron.handlers.set(channel, handler),
  },
}));
import { registerNetworkHandlers } from '../networkHandlers';

function dependencies() {
  const closeHandlers: Array<() => void> = [];
  return {
    closeHandlers,
    window: {
      isDestroyed: () => false,
      webContents: { send: vi.fn() },
      once: vi.fn((_event: string, handler: () => void) => closeHandlers.push(handler)),
    },
    friendTunnel: { getState: vi.fn(), host: vi.fn(), join: vi.fn(), stop: vi.fn(), subscribe: vi.fn(() => vi.fn()) },
    lanDiscovery: { getState: vi.fn(), start: vi.fn(), stop: vi.fn(), broadcast: vi.fn(), ping: vi.fn(), subscribe: vi.fn(() => vi.fn()), onDiscover: vi.fn(() => vi.fn()) },
    portMapping: { getState: vi.fn(), mapTcp: vi.fn(), unmapTcp: vi.fn(), stop: vi.fn(), subscribe: vi.fn(() => vi.fn()) },
  };
}

describe('network IPC handlers', () => {
  afterEach(() => electron.handlers.clear());

  it('routes validated requests to independent owners', async () => {
    const deps = dependencies();
    registerNetworkHandlers(deps as never);
    await electron.handlers.get(NETWORK_CHANNELS.tunnelHost)?.({}, { port: 25_565 });
    await electron.handlers.get(NETWORK_CHANNELS.lanStart)?.({}, { family: 'udp6' });
    await electron.handlers.get(NETWORK_CHANNELS.upnpMapTcp)?.({}, { publicPort: 25_565, privatePort: 25_566 });
    expect(deps.friendTunnel.host).toHaveBeenCalledWith(25_565);
    expect(deps.lanDiscovery.start).toHaveBeenCalledWith('udp6');
    expect(deps.portMapping.mapTcp).toHaveBeenCalledWith(25_565, 25_566);
  });

  it('rejects malformed codes, ports and extra authority fields', async () => {
    const deps = dependencies();
    registerNetworkHandlers(deps as never);
    await expect(electron.handlers.get(NETWORK_CHANNELS.tunnelJoin)?.({}, { roomCode: 'bad' })).rejects.toThrow();
    await expect(electron.handlers.get(NETWORK_CHANNELS.upnpMapTcp)?.({}, { publicPort: 0, privatePort: 1 })).rejects.toThrow();
    await expect(electron.handlers.get(NETWORK_CHANNELS.lanBroadcast)?.({}, { motd: 'world', port: 25_565, host: 'forged' })).rejects.toThrow(/unsupported/i);
  });

  it('forwards typed owner events and removes exact subscriptions with the window', () => {
    const deps = dependencies();
    const disposers = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    deps.friendTunnel.subscribe.mockReturnValue(disposers[0]);
    deps.lanDiscovery.subscribe.mockReturnValue(disposers[1]);
    deps.lanDiscovery.onDiscover.mockReturnValue(disposers[2]);
    deps.portMapping.subscribe.mockReturnValue(disposers[3]);
    registerNetworkHandlers(deps as never);
    const tunnelListener = (deps.friendTunnel.subscribe.mock.calls as unknown as Array<[(value: unknown) => void]>)[0][0];
    tunnelListener({ revision: 1, state: 'idle', role: null, peerCount: 0 });
    expect(deps.window.webContents.send).toHaveBeenCalledWith(NETWORK_CHANNELS.tunnelState, expect.objectContaining({ revision: 1 }));
    deps.closeHandlers[0]();
    disposers.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });
});
