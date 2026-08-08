import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectPlatformSmoke, parseReleaseArgs } from '../release.js';
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function smokeEvidence(platform: 'darwin' | 'linux' | 'win32') {
  const marker = { darwin: 'a', linux: 'b', win32: 'c' }[platform];
  return {
    schemaVersion: 1,
    status: platform === 'darwin' ? 'passed' : 'unsupported-runner',
    platform,
    version: '0.8.0-rc.1',
    artifact: { path: `Burrow-${platform}`, kind: platform === 'darwin' ? 'dmg' : platform === 'linux' ? 'appimage' : 'nsis', sha256: marker.repeat(64) },
    signing: { status: 'not-checked' },
    workspace: { cleanUserData: true, cleaned: true },
    launch: { command: 'Burrow', readiness: 'remote-debugging-page', windowCount: platform === 'darwin' ? 1 : 0, startedAt: '2026-08-05T00:00:00.000Z' },
    quit: { requested: platform === 'darwin', graceful: platform === 'darwin', exitCode: platform === 'darwin' ? 0 : null },
    logs: { stdout: '', stderr: '' },
    ...(platform === 'darwin' ? {} : { error: 'unsupported runner: foreign host' }),
  };
}

describe('release candidate guard', () => {
  it('keeps the local helper evidence-only', () => {
    expect(parseReleaseArgs(['0.8.0-rc.1', '--dry-run'])).toEqual({
      version: '0.8.0-rc.1',
      dryRun: true,
      platformSmokePath: undefined,
      releaseDir: undefined,
    });
  });

  it('writes fresh platform smoke files with the aggregate-compatible suffix', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-release-smoke-'));
    roots.push(root);
    const evidenceDir = path.join(root, 'evidence');
    const output = await collectPlatformSmoke({
      releaseDir: path.join(root, 'release'),
      version: '0.8.0-rc.1',
      evidenceDir,
      runSmoke: async ({ platform }: { platform: 'darwin' | 'linux' | 'win32' }) => smokeEvidence(platform),
    });

    expect(fs.readdirSync(evidenceDir).sort()).toEqual([
      'darwin-package-smoke.json',
      'linux-package-smoke.json',
      'platform-smoke.json',
      'win32-package-smoke.json',
    ]);
    expect(JSON.parse(fs.readFileSync(output, 'utf8')).map((entry: { platform: string }) => entry.platform)).toEqual(['darwin', 'linux', 'win32']);
  });
});
