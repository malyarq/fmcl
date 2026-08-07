import { describe, expect, it, vi } from 'vitest';
import { runGameLaunchSmoke } from '../gameLaunchSmoke';

function fakeLauncher(run: (callbacks: { log(line: string): void; close(code: number): void }) => void) {
  const killGameProcess = vi.fn().mockResolvedValue(undefined);
  return {
    killGameProcess,
    launchGame: vi.fn(async (_options, onLog, _onProgress, onClose) => {
      run({ log: onLog, close: onClose });
    }),
  };
}

describe('game launch smoke', () => {
  it('requires both rendering and loaded-resource evidence before passing', async () => {
    const launcher = fakeLauncher(({ log }) => {
      log('[Render thread/INFO]: Backend library: LWJGL version 3.3.3');
      log('[Render thread/INFO]: OpenAL initialized on device');
    });

    await expect(runGameLaunchSmoke({
      launcher: launcher as never,
      version: '1.21.8',
      onLog: vi.fn(),
      timeoutMs: 50,
      settleMs: 0,
    })).resolves.toMatchObject({
      ok: true,
      signals: ['render-backend', 'resources-ready'],
    });
    expect(launcher.killGameProcess).toHaveBeenCalledOnce();
  });

  it('fails when Minecraft closes before resources are ready', async () => {
    const launcher = fakeLauncher(({ log, close }) => {
      log('[Render thread/INFO]: Backend library: LWJGL version 3.3.3');
      close(1);
    });

    const result = await runGameLaunchSmoke({
      launcher: launcher as never,
      version: '1.21.8',
      onLog: vi.fn(),
      timeoutMs: 50,
      settleMs: 0,
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('exited before') });
    expect(launcher.killGameProcess).toHaveBeenCalledOnce();
  });

  it('fails when authlib-injector cannot transform the active Java class format', async () => {
    const launcher = fakeLauncher(({ log }) => {
      log('[authlib-injector] [WARNING] Failed to transform net.minecraft.client.main.Main');
      log('java.lang.IllegalArgumentException: Unsupported class file major version 69');
      log('[Render thread/INFO]: Backend library: LWJGL version 3.3.3');
      log('[Render thread/INFO]: OpenAL initialized on device');
    });

    const result = await runGameLaunchSmoke({
      launcher: launcher as never,
      version: '26.2',
      onLog: vi.fn(),
      timeoutMs: 50,
      settleMs: 0,
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('authlib-injector-incompatible-java'),
    });
    expect(launcher.killGameProcess).toHaveBeenCalledOnce();
  });
});
