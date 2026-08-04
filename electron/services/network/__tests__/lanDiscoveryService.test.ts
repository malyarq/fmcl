import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ failBind: false, instances: [] as Array<{
  bind: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; broadcast: ReturnType<typeof vi.fn>;
  emit(event: string, value: unknown): void;
}>, queryStatus: vi.fn() }));

vi.mock('@xmcl/client', () => ({
  MinecraftLanDiscover: class {
    public isReady = false;
    private readonly listeners = new Map<string, Set<(value: unknown) => void>>();
    public bind = vi.fn(async () => { if (mocks.failBind) throw new Error('bind failed'); this.isReady = true; });
    public destroy = vi.fn(async () => { this.isReady = false; });
    public broadcast = vi.fn(async () => 1);
    constructor(public readonly family = 'udp4') { mocks.instances.push(this); }
    on(event: string, listener: (value: unknown) => void) { const set = this.listeners.get(event) ?? new Set(); set.add(listener); this.listeners.set(event, set); return this; }
    removeListener(event: string, listener: (value: unknown) => void) { this.listeners.get(event)?.delete(listener); return this; }
    emit(event: string, value: unknown) { for (const listener of this.listeners.get(event) ?? []) listener(value); }
  },
  queryStatus: mocks.queryStatus,
}));
import { LanDiscoveryService } from '../lanDiscoveryService';

describe('LanDiscoveryService', () => {
  beforeEach(() => { mocks.instances.length = 0; mocks.failBind = false; vi.clearAllMocks(); });

  it('coalesces an already active generation and stops the exact owner', async () => {
    const service = new LanDiscoveryService();
    await service.start('udp4');
    await service.start('udp4');
    expect(mocks.instances).toHaveLength(1);
    await service.stop();
    expect(mocks.instances[0].destroy).toHaveBeenCalledOnce();
  });

  it('publishes bounded deduplicated discoveries', async () => {
    const service = new LanDiscoveryService();
    const listener = vi.fn();
    service.onDiscover(listener);
    await service.start();
    const event = { motd: 'A'.repeat(400), port: 25_565, remote: { address: '192.0.2.10' } };
    mocks.instances[0].emit('discover', event);
    mocks.instances[0].emit('discover', event);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0][0].motd).toHaveLength(256);
    expect(service.getState().discoveredCount).toBe(1);
  });

  it('contains bind failure and destroys the failed generation', async () => {
    const service = new LanDiscoveryService();
    mocks.failBind = true;
    const result = await service.start();
    expect(result).toMatchObject({ state: 'failed', diagnostic: { code: 'LAN_BIND_FAILED' } });
    expect(mocks.instances[0].destroy).toHaveBeenCalledOnce();
  });

  it('maps ping output to a serializable DTO', async () => {
    mocks.queryStatus.mockResolvedValue({
      description: 'Server', version: { name: '1.21', protocol: 767 }, players: { online: 2, max: 10 }, ping: 12,
    });
    await expect(new LanDiscoveryService().ping('localhost')).resolves.toEqual({
      status: 'ok', server: { description: 'Server', versionName: '1.21', protocol: 767, onlinePlayers: 2, maxPlayers: 10, latencyMs: 12 },
    });
  });

  it('returns a typed diagnostic when ping fails', async () => {
    mocks.queryStatus.mockRejectedValueOnce(new Error('/private/network details'));
    await expect(new LanDiscoveryService().ping('localhost')).resolves.toEqual({
      status: 'failed', diagnostic: { code: 'LAN_PING_FAILED', message: 'Minecraft server did not answer' },
    });
  });
});
