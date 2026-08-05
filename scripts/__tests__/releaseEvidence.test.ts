import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

type ReleaseEvidence = Readonly<{
  collectReleaseEvidence(options: unknown): Record<string, unknown>;
  validateReleaseEvidence(value: unknown): Readonly<{ valid: boolean; errors: string[] }>;
  verifySha256Sums(options: Readonly<{ verificationDir: string }>): Readonly<{ valid: boolean; mismatches: string[] }>;
}>;

const require = createRequire(import.meta.url);
const evidence = require('../release-evidence.js') as ReleaseEvidence;
const roots: string[] = [];

function createArtifacts(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-release-evidence-'));
  roots.push(root);
  return root;
}

function writeArtifact(root: string, name: string, contents: string): void {
  fs.writeFileSync(path.join(root, name), contents);
}

describe('release evidence integrity and authenticity contract', () => {
  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('writes a sorted SHA-256 manifest and verifies it from a clean directory without turning unsigned into signed', () => {
    const artifactsDir = createArtifacts();
    const verificationRoot = createArtifacts();
    writeArtifact(artifactsDir, 'FriendLauncher-Windows-0.7.1-Setup.exe', 'windows');
    writeArtifact(artifactsDir, 'FriendLauncher-Linux-0.7.1.AppImage', 'linux');
    writeArtifact(artifactsDir, 'FriendLauncher-Mac-0.7.1-Installer.dmg', 'mac');
    writeArtifact(artifactsDir, 'latest-mac.yml', 'updater metadata');
    writeArtifact(artifactsDir, 'builder-debug.yml', 'must not ship');
    writeArtifact(artifactsDir, 'unexpected-secret.txt', 'must not ship');

    const result = evidence.collectReleaseEvidence({
      artifactsDir,
      verificationRoot,
      candidate: { version: '0.7.1', tag: 'v0.7.1', commit: 'a'.repeat(40) },
      platform: 'linux',
      command: { has: () => false, run: () => ({ status: 127, stdout: '', stderr: '' }) },
      packagedSmoke: { status: 'not-run', evidencePath: null, artifactSha256: null },
    });

    expect(result).toMatchObject({
      status: 'passed',
      integrity: { algorithm: 'sha256', status: 'passed' },
      packagedSmoke: { status: 'not-run' },
    });
    expect((result.authenticity as Array<Record<string, unknown>>)).toEqual([
      expect.objectContaining({ platform: 'darwin', codeSigning: expect.objectContaining({ status: 'unavailable' }), notarization: expect.objectContaining({ status: 'unavailable' }) }),
      expect.objectContaining({ platform: 'linux', codeSigning: expect.objectContaining({ status: 'unavailable' }), notarization: expect.objectContaining({ status: 'unavailable' }) }),
      expect.objectContaining({ platform: 'win32', codeSigning: expect.objectContaining({ status: 'unavailable' }), notarization: expect.objectContaining({ status: 'unavailable' }) }),
    ]);
    expect(fs.readFileSync(path.join(artifactsDir, 'SHA256SUMS.txt'), 'utf8').split('\n').filter(Boolean).map((line) => line.slice(66))).toEqual([
      'FriendLauncher-Linux-0.7.1.AppImage',
      'FriendLauncher-Mac-0.7.1-Installer.dmg',
      'FriendLauncher-Windows-0.7.1-Setup.exe',
      'latest-mac.yml',
    ]);
    expect(result.artifacts).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'latest-mac.yml', kind: 'release-asset', platform: 'shared' })]));
    expect(result.artifacts).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'builder-debug.yml' }),
      expect.objectContaining({ path: 'unexpected-secret.txt' }),
    ]));
    expect(evidence.validateReleaseEvidence(result)).toEqual({ valid: true, errors: [] });
  });

  it('keeps ordering stable, detects a modified clean-room artifact, and links package smoke only by the matching checksum', () => {
    const first = createArtifacts();
    const second = createArtifacts();
    const firstVerification = createArtifacts();
    const secondVerification = createArtifacts();
    for (const [name, contents] of [
      ['FriendLauncher-Windows-0.7.1-Setup.exe', 'windows'],
      ['FriendLauncher-Mac-0.7.1-Installer.dmg', 'mac'],
      ['FriendLauncher-Linux-0.7.1.AppImage', 'linux'],
      ['latest-mac.yml', 'updater metadata'],
    ]) {
      writeArtifact(first, name, contents);
      writeArtifact(second, name, contents);
    }
    const candidate = { version: '0.7.1', tag: 'v0.7.1', commit: 'b'.repeat(40) };
    const reverseDirectoryOrder = { readdir: (target: fs.PathLike, options: object) => fs.readdirSync(target, options as { withFileTypes: true }).reverse() };
    const firstEvidence = evidence.collectReleaseEvidence({ artifactsDir: first, verificationRoot: firstVerification, candidate, platform: 'linux', command: { has: () => false, run: () => ({ status: 127, stdout: '', stderr: '' }) } });
    const secondEvidence = evidence.collectReleaseEvidence({ artifactsDir: second, verificationRoot: secondVerification, candidate, platform: 'linux', fileSystem: reverseDirectoryOrder, command: { has: () => false, run: () => ({ status: 127, stdout: '', stderr: '' }) } });

    expect(secondEvidence.artifacts).toEqual(firstEvidence.artifacts);
    fs.writeFileSync(path.join(firstVerification, 'FriendLauncher-Linux-0.7.1.AppImage'), 'tampered');
    expect(evidence.verifySha256Sums({ verificationDir: firstVerification })).toEqual({ valid: false, mismatches: ['FriendLauncher-Linux-0.7.1.AppImage: checksum mismatch'] });

    const macHash = (firstEvidence.artifacts as Array<Record<string, string>>).find((artifact) => artifact.platform === 'darwin')?.sha256;
    const linked = evidence.collectReleaseEvidence({
      artifactsDir: first,
      verificationRoot: createArtifacts(),
      candidate,
      platform: 'linux',
      command: { has: () => false, run: () => ({ status: 127, stdout: '', stderr: '' }) },
      packagedSmoke: { status: 'passed', evidencePath: 'package-smoke.json', artifactSha256: macHash },
    });
    expect(linked.packagedSmoke).toEqual({ status: 'passed', evidencePath: 'package-smoke.json', artifactSha256: macHash });
  });

  it('reports explicit macOS and Windows verification status without treating unknown output as signed', () => {
    const artifactsDir = createArtifacts();
    writeArtifact(artifactsDir, 'FriendLauncher-Mac-0.7.1-Installer.dmg', 'mac');
    writeArtifact(artifactsDir, 'FriendLauncher-Windows-0.7.1-Setup.exe', 'windows');
    const candidate = { version: '0.7.1', tag: 'v0.7.1', commit: 'c'.repeat(40) };
    const mac = evidence.collectReleaseEvidence({
      artifactsDir,
      verificationRoot: createArtifacts(),
      candidate,
      platform: 'darwin',
      command: {
        has: (command: string) => ['codesign', 'spctl'].includes(command),
        run: (command: string) => command === 'codesign'
          ? { status: 0, stdout: 'valid on disk', stderr: '' }
          : { status: 0, stdout: 'accepted source=Notarized Developer ID', stderr: '' },
      },
    });
    const windowsUnsigned = evidence.collectReleaseEvidence({
      artifactsDir,
      verificationRoot: createArtifacts(),
      candidate,
      platform: 'win32',
      command: {
        has: (command: string) => command === 'signtool',
        run: () => ({ status: 1, stdout: '', stderr: 'SignTool Error: No signature found.' }),
      },
    });
    const unknown = evidence.collectReleaseEvidence({
      artifactsDir,
      verificationRoot: createArtifacts(),
      candidate,
      platform: 'win32',
      command: { has: (command: string) => command === 'signtool', run: () => ({ status: 3, stdout: 'unexpected verifier state', stderr: '' }) },
    });

    expect((mac.authenticity as Array<Record<string, Record<string, string>>>)[0]).toMatchObject({ codeSigning: { status: 'signed' }, notarization: { status: 'notarized' } });
    expect((windowsUnsigned.authenticity as Array<Record<string, Record<string, string>>>)[2]).toMatchObject({ codeSigning: { status: 'unsigned' }, notarization: { status: 'unavailable' } });
    expect(unknown).toMatchObject({ status: 'failed', integrity: { status: 'passed' }, failures: [expect.stringMatching(/unrecognized Windows Authenticode output/)] });
  });

  it('rejects a smoke hash without a release artifact and any overwrite rollback policy', () => {
    const artifactsDir = createArtifacts();
    writeArtifact(artifactsDir, 'FriendLauncher-Linux-0.7.1.AppImage', 'linux');
    const candidate = { version: '0.7.1', tag: 'v0.7.1', commit: 'd'.repeat(40) };
    const result = evidence.collectReleaseEvidence({ artifactsDir, verificationRoot: createArtifacts(), candidate, platform: 'linux', command: { has: () => false, run: () => ({ status: 127, stdout: '', stderr: '' }) } });

    expect(evidence.validateReleaseEvidence({ ...result, packagedSmoke: { status: 'passed', evidencePath: 'smoke.json', artifactSha256: 'e'.repeat(64) } })).toMatchObject({ valid: false });
    expect(evidence.validateReleaseEvidence({ ...result, rollback: { ...result.rollback as Record<string, unknown>, decision: 'overwrite-stable-asset' } })).toMatchObject({ valid: false });
    expect(() => evidence.collectReleaseEvidence({
      artifactsDir,
      verificationRoot: createArtifacts(),
      candidate,
      rollback: { immutable: true, decision: 'overwrite-stable-tag', permittedActions: ['overwrite-stable-tag'], prohibitedActions: [], instructions: 'overwrite' },
    })).toThrow(/rollback policy/);
  });

  it('writes the same schema-valid evidence to an explicit output path for the shared release profile', () => {
    const outputRoot = createArtifacts();
    const output = path.join(outputRoot, 'release-evidence.json');
    const script = path.join(process.cwd(), 'scripts/release-evidence.js');
    const result = spawnSync(process.execPath, [script, '--fixture-unsigned', '--output', output], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toMatchObject({ status: 'passed', candidate: { version: '0.7.1' } });
    expect(JSON.parse(result.stdout)).toEqual(JSON.parse(fs.readFileSync(output, 'utf8')));
  });
});
