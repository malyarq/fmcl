import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PortMappingService } from '../portMappingService';

const gateway = {
  mapAll: vi.fn(), unmap: vi.fn(), stop: vi.fn(),
};
const client = { findGateways: vi.fn() };

async function* one<T>(value: T) { yield value; }

describe('PortMappingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.findGateways.mockImplementation(() => one(gateway));
    gateway.mapAll.mockImplementation(() => one({ externalHost: '203.0.113.2', externalPort: 25_565, internalPort: 25_565 }));
    gateway.unmap.mockResolvedValue(undefined);
    gateway.stop.mockResolvedValue(undefined);
  });

  it('owns a mapping and removes bookkeeping only after unmap', async () => {
    const service = new PortMappingService({ createClient: (() => client) as never });
    await expect(service.mapTcp(25_565, 25_565)).resolves.toMatchObject({ state: 'active', mappings: [{ publicPort: 25_565 }] });
    await expect(service.unmapTcp(25_565)).resolves.toMatchObject({ state: 'idle', mappings: [] });
    expect(gateway.unmap).toHaveBeenCalledWith(25_565);
  });

  it('keeps mapping truth when unmap fails', async () => {
    const service = new PortMappingService({ createClient: (() => client) as never });
    await service.mapTcp(25_565, 25_565);
    gateway.unmap.mockRejectedValueOnce(new Error('router failed'));
    await expect(service.unmapTcp(25_565)).resolves.toMatchObject({
      state: 'failed', mappings: [{ publicPort: 25_565 }], diagnostic: { code: 'UPNP_UNMAP_FAILED' },
    });
  });

  it('coalesces gateway ownership and uses gateway stop for full cleanup', async () => {
    const service = new PortMappingService({ createClient: (() => client) as never });
    await service.mapTcp(25_565, 25_565);
    await service.mapTcp(25_566, 25_566);
    expect(client.findGateways).toHaveBeenCalledOnce();
    await expect(service.stop()).resolves.toMatchObject({ state: 'idle', mappings: [] });
    expect(gateway.stop).toHaveBeenCalledOnce();
  });

  it('retains failed state when gateway cleanup cannot be proven', async () => {
    const service = new PortMappingService({ createClient: (() => client) as never });
    await service.mapTcp(25_565, 25_565);
    gateway.stop.mockRejectedValueOnce(new Error('cleanup failed'));
    await expect(service.stop()).resolves.toMatchObject({ state: 'failed', diagnostic: { code: 'UPNP_CLEANUP_FAILED' } });
  });
});
