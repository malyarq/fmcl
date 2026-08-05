import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { collectPlatformSmoke } from '../release.js';

const releaseScript = fileURLToPath(new URL('../release.js', import.meta.url));
const prepushScript = fileURLToPath(new URL('../prepush-release-report.js', import.meta.url));
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
    artifact: { path: `FriendLauncher-${platform}`, kind: platform === 'darwin' ? 'dmg' : platform === 'linux' ? 'appimage' : 'nsis', sha256: marker.repeat(64) },
    signing: { status: 'not-checked' },
    workspace: { cleanUserData: true, cleaned: true },
    launch: { command: 'FriendLauncher', readiness: 'remote-debugging-page', windowCount: platform === 'darwin' ? 1 : 0, startedAt: '2026-08-05T00:00:00.000Z' },
    quit: { requested: platform === 'darwin', graceful: platform === 'darwin', exitCode: platform === 'darwin' ? 0 : null },
    logs: { stdout: '', stderr: '' },
    ...(platform === 'darwin' ? {} : { error: 'unsupported runner: foreign host' }),
  };
}

function inspectReleaseModule() {
  const source = `
    import { parseReleaseArgs, validateApprovedReport } from ${JSON.stringify(releaseScript)};
    import { createPrepushReleaseReport } from ${JSON.stringify(prepushScript)};

    const candidate = { version: '0.8.0-rc.1', tag: 'v0.8.0-rc.1', commit: 'a'.repeat(40) };
    const artifacts = [
      { path: 'FriendLauncher-Mac-0.8.0-rc.1-Installer.dmg', platform: 'darwin', sha256: 'a'.repeat(64) },
      { path: 'FriendLauncher-Linux-0.8.0-rc.1.AppImage', platform: 'linux', sha256: 'b'.repeat(64) },
      { path: 'FriendLauncher-Windows-0.8.0-rc.1-Setup.exe', platform: 'win32', sha256: 'c'.repeat(64) },
    ];
    const report = createPrepushReleaseReport({
      candidate,
      packageVersion: candidate.version,
      cleanWorktree: true,
      qualityResult: { profile: 'release', status: 'passed' },
      releaseEvidence: {
        status: 'passed',
        candidate,
        artifacts,
        authenticity: ['darwin', 'linux', 'win32'].map((platform) => ({ platform })),
        rollback: {
          immutable: true,
          decision: 'withdraw-or-mark-non-latest',
          permittedActions: ['withdraw-or-mark-non-latest', 'publish-new-patch'],
          prohibitedActions: ['overwrite-stable-tag', 'overwrite-stable-asset'],
          instructions: 'Never overwrite an existing stable tag or asset',
        },
        failures: [],
      },
      platformSmoke: artifacts.map((artifact) => ({
        platform: artifact.platform,
        status: 'passed',
        artifactSha256: artifact.sha256,
        evidencePath: 'smoke/' + artifact.platform + '.json',
        signing: 'unsigned',
      })),
    });
    let missingApproval = false;
    try { validateApprovedReport({ report, candidate, approval: undefined }); } catch { missingApproval = true; }
    let mismatch = false;
    try { validateApprovedReport({ report, candidate: { ...candidate, commit: 'b'.repeat(40) }, approval: 'approve-local-release' }); } catch { mismatch = true; }
    console.log(JSON.stringify({ args: parseReleaseArgs(['0.8.0-rc.1', '--dry-run']), valid: validateApprovedReport({ report, candidate, approval: 'approve-local-release' }).reportId, missingApproval, mismatch }));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as { args: { version: string; dryRun: boolean; push: boolean }; valid: string; missingApproval: boolean; mismatch: boolean };
}

describe('release candidate guard', () => {
  it('parses dry-run mode and rejects unapproved or mismatched reports before any mutation mode', () => {
    const result = inspectReleaseModule();
    expect(result.args).toMatchObject({ version: '0.8.0-rc.1', dryRun: true, push: false });
    expect(result.valid).toMatch(/^prepush-[a-f0-9]{64}$/);
    expect(result.missingApproval).toBe(true);
    expect(result.mismatch).toBe(true);
  });

  it('writes fresh platform smoke files with the aggregate-compatible suffix', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-release-smoke-'));
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
