import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findGateways: vi.fn(),
  mapAll: vi.fn(),
  unmap: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('@achingbrain/nat-port-mapper', () => ({
  upnpNat: () => ({ findGateways: mocks.findGateways }),
}));

vi.mock('@xmcl/client', () => ({
  MinecraftLanDiscover: class {},
  queryStatus: vi.fn(),
}));

vi.mock('../networkManager', () => ({
  NetworkManager: class {
    host = vi.fn();
    join = vi.fn();
    stop = vi.fn();
  },
}));

import { NetworkService } from '../networkService';

async function* yieldOne<T>(value: T) {
  yield value;
}

describe('NetworkService UPnP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stop.mockResolvedValue(undefined);
    mocks.unmap.mockResolvedValue(undefined);
    mocks.findGateways.mockImplementation(() => yieldOne({
      mapAll: mocks.mapAll,
      unmap: mocks.unmap,
      stop: mocks.stop,
    }));
    mocks.mapAll.mockImplementation(() => yieldOne({
      externalHost: '203.0.113.10',
      externalPort: 25565,
      internalHost: '192.168.1.10',
      internalPort: 25565,
      protocol: 'TCP',
    }));
  });

  it('maps and unmaps the requested TCP port through the discovered gateway', async () => {
    const service = new NetworkService();

    await expect(service.upnpMapTcp(25565, 25565)).resolves.toEqual({
      externalIp: '203.0.113.10',
    });
    expect(mocks.mapAll).toHaveBeenCalledWith(25565, expect.objectContaining({
      externalPort: 25565,
      protocol: 'TCP',
    }));

    await expect(service.upnpUnmapTcp(25565)).resolves.toBe(true);
    expect(mocks.unmap).toHaveBeenCalledWith(25565);
    await expect(service.upnpUnmapTcp(25565)).resolves.toBe(false);
  });

  it('stops the gateway and clears mappings with the session', async () => {
    const service = new NetworkService();
    await service.upnpMapTcp(25565, 25565);

    await service.stop(vi.fn());

    expect(mocks.stop).toHaveBeenCalledOnce();
    await expect(service.upnpUnmapTcp(25565)).resolves.toBe(false);
  });
});
