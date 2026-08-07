import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aggregatePlatformSmoke, writePlatformSmokeAggregate } from '../aggregate-platform-smoke.js';

const roots: string[] = [];

function evidence(platform: 'darwin' | 'linux' | 'win32', marker: string) {
  return {
    schemaVersion: 1,
    status: 'passed',
    platform,
    version: '0.8.0-rc.1',
    artifact: { path: `FriendLauncher-${platform}`, kind: platform === 'darwin' ? 'dmg' : platform === 'linux' ? 'appimage' : 'nsis', sha256: marker.repeat(64) },
    signing: { status: 'not-checked' },
    workspace: { cleanUserData: true, cleaned: true },
    launch: { command: 'FriendLauncher', readiness: 'remote-debugging-page', windowCount: 1, startedAt: '2026-08-05T00:00:00.000Z' },
    quit: { requested: true, graceful: true, exitCode: 0 },
    logs: { stdout: '', stderr: '' },
    upgrade: {
      attempted: true,
      previousVersion: '0.8.0',
      previousArtifactSha256: 'f'.repeat(64),
      previousLaunchVerified: true,
      userDataPreserved: true,
    },
  };
}

function createInput(records = [evidence('win32', 'c'), evidence('darwin', 'a'), evidence('linux', 'b')]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-platform-smoke-'));
  roots.push(root);
  records.forEach((record, index) => {
    const directory = path.join(root, `artifact-${index}`);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, `${index}-package-smoke.json`), JSON.stringify(record));
  });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('platform smoke aggregation', () => {
  it('validates downloaded evidence and emits deterministic platform order with real paths', () => {
    const input = createInput();
    const output = path.join(input, 'verified', 'platform-smoke.json');
    const value = writePlatformSmokeAggregate({ inputDir: input, outputFile: output });

    expect(value.map((entry) => entry?.platform)).toEqual(['darwin', 'linux', 'win32']);
    expect(value.every((entry) => entry?.evidencePath.includes(input))).toBe(true);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toEqual(value);
  });

  it('rejects missing, duplicate, failed, and invalid-hash evidence', () => {
    expect(() => aggregatePlatformSmoke({ inputDir: createInput([evidence('darwin', 'a')]) })).toThrow(/missing/i);
    expect(() => aggregatePlatformSmoke({ inputDir: createInput([evidence('darwin', 'a'), evidence('darwin', 'b'), evidence('linux', 'c'), evidence('win32', 'd')]) })).toThrow(/duplicate/i);
    expect(() => aggregatePlatformSmoke({ inputDir: createInput([{ ...evidence('darwin', 'a'), status: 'failed' }, evidence('linux', 'b'), evidence('win32', 'c')]) })).toThrow(/did not pass/i);
    expect(() => aggregatePlatformSmoke({ inputDir: createInput([{ ...evidence('darwin', 'a'), artifact: { ...evidence('darwin', 'a').artifact, sha256: '' } }, evidence('linux', 'b'), evidence('win32', 'c')]) })).toThrow(/hash/i);
    expect(() => aggregatePlatformSmoke({
      inputDir: createInput([{ ...evidence('darwin', 'a'), upgrade: undefined }, evidence('linux', 'b'), evidence('win32', 'c')]),
      requireUpgrade: true,
    })).toThrow(/upgrade/i);
  });
});
