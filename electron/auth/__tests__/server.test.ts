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

  it('returns the Yggdrasil no-profile response instead of invalid JSON', async () => {
    const server = new AuthServer(0); servers.push(server);
    await server.start();

    const response = await fetch(`${server.url}/sessionserver/session/minecraft/profile/e6c775be5be937a6bfd5f5ecbc68bdc5`);

    expect(response.status).toBe(204);
    await expect(response.text()).resolves.toBe('');
  });
});
