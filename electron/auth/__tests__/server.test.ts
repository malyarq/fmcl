import { afterEach, describe, expect, it } from 'vitest';
import { AuthServer } from '../server';

describe('AuthServer lifecycle', () => {
  const servers: AuthServer[] = [];
  afterEach(async () => await Promise.allSettled(servers.splice(0).map((server) => server.stop())));

  it('resolves only after listening and stops idempotently', async () => {
    const server = new AuthServer(0); servers.push(server);
    const started = await server.start();
    expect(started).toEqual({ url: server.url, owned: true });
    await expect(fetch(server.url)).resolves.toMatchObject({ status: 200 });
    expect(server.stop()).toBe(server.stop());
    await server.stop();
  });

  it('accepts a busy port only after verifying a compatible server', async () => {
    const owner = new AuthServer(0); servers.push(owner);
    await owner.start();
    const port = Number(new URL(owner.url).port);
    const follower = new AuthServer(port); servers.push(follower);
    await expect(follower.start()).resolves.toEqual({ url: owner.url, owned: false });
  });
});
