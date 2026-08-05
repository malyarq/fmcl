import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const releaseScript = fileURLToPath(new URL('../release.js', import.meta.url));
const prepushScript = fileURLToPath(new URL('../prepush-release-report.js', import.meta.url));

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
});
