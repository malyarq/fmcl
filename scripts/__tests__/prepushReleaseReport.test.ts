import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

type Report = Readonly<{
  createPrepushReleaseReport(options: Record<string, unknown>): Record<string, unknown>;
  validatePrepushReleaseReport(value: unknown): Readonly<{ valid: boolean; errors: string[] }>;
  writePrepushReleaseReport(options: Record<string, unknown>): Record<string, unknown>;
  assertNoMutationCommands(source: string): void;
}>;

const require = createRequire(import.meta.url);
const report = require('../prepush-release-report.js') as Report;
const roots: string[] = [];
const sha = (value: string) => value.repeat(64).slice(0, 64);

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture(overrides: Record<string, unknown> = {}) {
  const candidate = { version: '0.8.0-rc.1', tag: 'v0.8.0-rc.1', commit: 'a'.repeat(40) };
  return {
    candidate,
    packageVersion: candidate.version,
    cleanWorktree: true,
    qualityResult: { schemaVersion: 1, profile: 'release', status: 'passed', stages: [{ name: 'bundle', status: 'passed', exitCode: 0 }] },
    releaseEvidence: {
      schemaVersion: 1,
      status: 'passed',
      candidate,
      artifacts: [
        { path: 'FriendLauncher-Mac-0.8.0-rc.1-Installer.dmg', platform: 'darwin', kind: 'dmg', bytes: 1, sha256: sha('a') },
        { path: 'FriendLauncher-Linux-0.8.0-rc.1.AppImage', platform: 'linux', kind: 'appimage', bytes: 1, sha256: sha('b') },
        { path: 'FriendLauncher-Windows-0.8.0-rc.1-Setup.exe', platform: 'win32', kind: 'nsis', bytes: 1, sha256: sha('c') },
      ],
      integrity: { algorithm: 'sha256', manifest: 'SHA256SUMS.txt', verification: 'clean-verification-directory', status: 'passed' },
      authenticity: [
        { platform: 'darwin', codeSigning: { status: 'unsigned' }, notarization: { status: 'unsigned' } },
        { platform: 'linux', codeSigning: { status: 'unavailable' }, notarization: { status: 'unavailable' } },
        { platform: 'win32', codeSigning: { status: 'unsigned' }, notarization: { status: 'unavailable' } },
      ],
      packagedSmoke: { status: 'not-run', evidencePath: null, artifactSha256: null },
      rollback: { immutable: true, decision: 'withdraw-or-mark-non-latest', permittedActions: ['withdraw-or-mark-non-latest', 'publish-new-patch'], prohibitedActions: ['overwrite-stable-tag', 'overwrite-stable-asset'], instructions: 'Never overwrite an existing stable tag or asset' },
      failures: [],
    },
    platformSmoke: [
      { platform: 'darwin', status: 'passed', artifactSha256: sha('a'), evidencePath: 'smoke/darwin.json', signing: 'unsigned' },
      { platform: 'linux', status: 'unsupported-runner', artifactSha256: sha('b'), evidencePath: 'smoke/linux.json', signing: 'unavailable', reason: 'host image unavailable' },
      { platform: 'win32', status: 'passed', artifactSha256: sha('c'), evidencePath: 'smoke/win32.json', signing: 'unsigned' },
    ],
    ...overrides,
  };
}

describe('pre-push release report', () => {
  it('creates schema-valid tag/commit/version/artifact-bound decision evidence with explicit unsupported disclosure', () => {
    const value = report.createPrepushReleaseReport(fixture());
    expect(value).toMatchObject({ status: 'passed', candidate: { tag: 'v0.8.0-rc.1', commit: 'a'.repeat(40) }, rollback: { immutable: true, decision: 'withdraw-or-mark-non-latest' } });
    expect(value.platformSmoke).toEqual(expect.arrayContaining([expect.objectContaining({ platform: 'linux', status: 'unsupported-runner', reason: 'host image unavailable' })]));
    expect(report.validatePrepushReleaseReport(value)).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ['mismatched evidence candidate', { releaseEvidence: { ...fixture().releaseEvidence as object, candidate: { version: '0.8.0-rc.1', tag: 'v0.8.0-rc.1', commit: 'b'.repeat(40) } } }],
    ['dirty worktree', { cleanWorktree: false }],
    ['incomplete artifact evidence', { platformSmoke: fixture().platformSmoke.slice(0, 2) }],
    ['overwrite rollback', { releaseEvidence: { ...fixture().releaseEvidence as object, rollback: { immutable: true, decision: 'overwrite-stable-asset', permittedActions: ['overwrite-stable-asset'], prohibitedActions: [], instructions: 'overwrite' } } }],
  ])('rejects %s', (_name, overrides) => {
    expect(() => report.createPrepushReleaseReport(fixture(overrides))).toThrow();
  });

  it('writes a report to the ignored evidence path without shelling out and rejects malformed schemas', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-prepush-report-'));
    roots.push(root);
    const output = path.join(root, 'prepush-release-report.json');
    const result = report.writePrepushReleaseReport({ ...fixture(), outputFile: output });
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(result);
    expect(report.validatePrepushReleaseReport({ ...result, reportId: '' })).toMatchObject({ valid: false });
  });

  it('proves the decision-evidence generator contains no Git or remote mutation command', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'scripts/prepush-release-report.js'), 'utf8');
    expect(() => report.assertNoMutationCommands(source)).not.toThrow();
    expect(() => report.assertNoMutationCommands("child_process.execSync('git push origin v0.8.0')")).toThrow(/forbidden mutation/i);
  });
});
