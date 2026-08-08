import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { BurrowLinkService } from '../burrowLinkService';

class FakeDiscovery {
  public flushed = vi.fn(async () => undefined);
  public destroy = vi.fn(async () => undefined);
}

class FakeSwarm extends EventEmitter {
  public readonly discovery = new FakeDiscovery();
  public readonly connections = new Set<unknown>();
  public join = vi.fn(() => this.discovery);
  public destroy = vi.fn(async () => undefined);
  public leave = vi.fn(async () => undefined);
}

function serviceWith(...swarms: FakeSwarm[]) {
  let index = 0;
  return new BurrowLinkService({
    createSwarm: (() => swarms[index++]) as never,
    randomBytes: (() => Buffer.alloc(32, 7)) as never,
  });
}

describe('BurrowLinkService', () => {
  it('owns and destroys a complete host session', async () => {
    const swarm = new FakeSwarm();
    const service = serviceWith(swarm);
    const active = await service.host(25_565);
    expect(active).toMatchObject({ state: 'active', role: 'host', roomCode: '07'.repeat(32) });
    expect(swarm.join).toHaveBeenCalledOnce();

    await expect(service.stop()).resolves.toMatchObject({ state: 'idle', role: null });
    expect(swarm.discovery.destroy).toHaveBeenCalledOnce();
    expect(swarm.destroy).toHaveBeenCalledOnce();
  });

  it('rejects malformed room codes before discovery', async () => {
    const swarm = new FakeSwarm();
    const service = serviceWith(swarm);
    await expect(service.join('not-a-room')).resolves.toMatchObject({
      state: 'failed', diagnostic: { code: 'INVALID_REQUEST' },
    });
    expect(swarm.join).not.toHaveBeenCalled();
  });

  it('contains discovery failure and cleans the created swarm', async () => {
    const swarm = new FakeSwarm();
    swarm.discovery.flushed.mockRejectedValueOnce(new Error('DHT unavailable'));
    const service = serviceWith(swarm);
    await expect(service.host(25_565)).resolves.toMatchObject({
      state: 'failed', diagnostic: { code: 'TUNNEL_DISCOVERY_FAILED' },
    });
    expect(swarm.discovery.destroy).toHaveBeenCalledOnce();
    expect(swarm.destroy).toHaveBeenCalledOnce();
  });

  it('fully stops the host before starting a join session', async () => {
    const hostSwarm = new FakeSwarm();
    const joinSwarm = new FakeSwarm();
    const service = serviceWith(hostSwarm, joinSwarm);
    await service.host(25_565);
    const joined = await service.join('ab'.repeat(32));
    expect(hostSwarm.destroy).toHaveBeenCalledOnce();
    expect(joined).toMatchObject({ state: 'active', role: 'join' });
    await service.stop();
    expect(joinSwarm.destroy).toHaveBeenCalledOnce();
  });

  it('serializes concurrent starts without retaining the first session', async () => {
    const first = new FakeSwarm();
    const second = new FakeSwarm();
    const service = serviceWith(first, second);
    const [host, join] = await Promise.all([service.host(25_565), service.join('cd'.repeat(32))]);
    expect(host.role).toBe('host');
    expect(join.role).toBe('join');
    expect(first.destroy).toHaveBeenCalledOnce();
    await service.stop();
  });
});

