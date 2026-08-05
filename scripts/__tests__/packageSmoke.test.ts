import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

type PackageSmoke = Readonly<{
  findPackagedArtifact(options: Readonly<{ releaseDir: string; version: string; platform: NodeJS.Platform }>): Readonly<{ path: string; kind: string; platform: string }>;
  validatePackageSmokeEvidence(value: unknown): Readonly<{ valid: boolean; errors: string[] }>;
  createPlatformAdapter(platform: NodeJS.Platform, options: unknown): Readonly<{ command: string; args: string[]; cleanup(): void }>;
  runPackageSmoke(options: unknown): Promise<Record<string, unknown>>;
}>;

const require = createRequire(import.meta.url);
const smoke = require('../package-smoke.js') as PackageSmoke;

function createRelease(version = '0.7.1'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-package-smoke-'));
  fs.mkdirSync(path.join(root, version), { recursive: true });
  return root;
}

function writeArtifact(releaseRoot: string, version: string, name: string): void {
  fs.writeFileSync(path.join(releaseRoot, version, name), 'fixture');
}

describe('package smoke artifact contract', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  });

  it('selects only the exact electron-builder artifact for each host adapter', () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer.dmg`);
    writeArtifact(releaseRoot, version, `FriendLauncher-Windows-${version}-Setup.exe`);
    writeArtifact(releaseRoot, version, `FriendLauncher-Linux-${version}.AppImage`);

    expect(smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'darwin' })).toMatchObject({
      kind: 'dmg', platform: 'darwin', path: expect.stringMatching(/Installer\.dmg$/),
    });
    expect(smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'win32' })).toMatchObject({
      kind: 'nsis', platform: 'win32', path: expect.stringMatching(/Setup\.exe$/),
    });
    expect(smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'linux' })).toMatchObject({
      kind: 'appimage', platform: 'linux', path: expect.stringMatching(/\.AppImage$/),
    });
  });

  it('accepts a release directory already scoped to the requested version', () => {
    const version = '0.8.0-rc.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer.dmg`);

    expect(smoke.findPackagedArtifact({ releaseDir: path.join(releaseRoot, version), version, platform: 'darwin' })).toMatchObject({
      kind: 'dmg', platform: 'darwin', path: expect.stringMatching(new RegExp(`${version}-Installer\\.dmg$`)),
    });
  });

  it('rejects missing, duplicate and source artifacts before process launch', () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);

    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'darwin' })).toThrow(/missing/i);
    writeArtifact(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer.dmg`);
    writeArtifact(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer (copy).dmg`);
    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'darwin' })).not.toThrow();
    fs.writeFileSync(path.join(releaseRoot, version, 'FriendLauncher-Mac-0.7.1-Installer.dmg'), 'fixture');
    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'darwin' })).not.toThrow();
    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'freebsd' })).toThrow(/unsupported/i);
  });

  it('accepts complete packaged evidence and rejects incomplete quit/log evidence', () => {
    const complete = {
      schemaVersion: 1,
      status: 'passed',
      platform: 'darwin',
      version: '0.7.1',
      artifact: { path: 'FriendLauncher-Mac-0.7.1-Installer.dmg', kind: 'dmg', sha256: 'a'.repeat(64) },
      signing: { status: 'not-checked' },
      workspace: { cleanUserData: true, cleaned: true },
      launch: { command: 'FriendLauncher', readiness: 'remote-debugging-page', windowCount: 1, startedAt: '2026-08-05T00:00:00.000Z' },
      quit: { requested: true, graceful: true, exitCode: 0 },
      logs: { stdout: '', stderr: '' },
    };

    expect(smoke.validatePackageSmokeEvidence(complete)).toEqual({ valid: true, errors: [] });
    const withoutSigning = { ...complete };
    delete withoutSigning.signing;
    expect(smoke.validatePackageSmokeEvidence(withoutSigning)).toMatchObject({ valid: false });
    expect(smoke.validatePackageSmokeEvidence({ ...complete, quit: { requested: true } })).toMatchObject({ valid: false });
    expect(smoke.validatePackageSmokeEvidence({ ...complete, logs: { stdout: '' } })).toMatchObject({ valid: false });
  });

  it('constructs native adapter commands through injected filesystem ports', () => {
    const root = createRelease();
    roots.push(root);
    const calls: string[] = [];
    const macMount = path.join(root, 'workspace', 'mounted-dmg');
    fs.mkdirSync(path.join(macMount, 'FriendLauncher.app', 'Contents', 'MacOS'), { recursive: true });
    fs.writeFileSync(path.join(macMount, 'FriendLauncher.app', 'Contents', 'MacOS', 'FriendLauncher'), 'fixture');
    const ports = {
      mkdir: (target: string) => fs.mkdirSync(target, { recursive: true }),
      exists: fs.existsSync,
      copyBundle: (from: string, to: string) => { calls.push(`copy:${from}:${to}`); fs.cpSync(from, to, { recursive: true }); },
      execFile: (command: string, args: string[]) => { calls.push(`${command}:${args.join(' ')}`); },
      chmod: (target: string, mode: number) => calls.push(`chmod:${target}:${mode.toString(8)}`),
    };
    const mac = smoke.createPlatformAdapter('darwin', { artifactPath: '/artifacts/FriendLauncher-Mac-0.7.1-Installer.dmg', workspace: path.join(root, 'workspace'), ports });
    const win = smoke.createPlatformAdapter('win32', {
      artifactPath: '/artifacts/FriendLauncher-Windows-0.7.1-Setup.exe', workspace: path.join(root, 'windows'),
      ports: { ...ports, exists: (target: string) => target.endsWith('FriendLauncher.exe') },
    });
    const linux = smoke.createPlatformAdapter('linux', { artifactPath: '/artifacts/FriendLauncher-Linux-0.7.1.AppImage', workspace: path.join(root, 'linux'), ports });

    expect(mac.command).toMatch(/FriendLauncher\.app\/Contents\/MacOS\/FriendLauncher$/);
    expect(win.command).toMatch(/installed[\\/]FriendLauncher\.exe$/);
    expect(linux).toMatchObject({ command: '/artifacts/FriendLauncher-Linux-0.7.1.AppImage', args: [] });
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining('hdiutil:attach'),
      expect.stringContaining('hdiutil:detach'),
      expect.stringContaining('FriendLauncher-Windows-0.7.1-Setup.exe:/S'),
      expect.stringContaining('chmod:/artifacts/FriendLauncher-Linux-0.7.1.AppImage:755'),
    ]));
  });

  it('records readiness timeout and abnormal exit with fake process ports while retaining the caller release directory', async () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer.dmg`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-package-smoke-runtime-'));
    roots.push(workspace);
    const createChild = () => Object.assign(new EventEmitter(), {
      exitCode: null as number | null,
      stdout: new EventEmitter(), stderr: new EventEmitter(),
      kill: () => undefined,
    });
    const runtime = {
      mkdtemp: () => workspace,
      rm: (target: string) => fs.rmSync(target, { recursive: true, force: true }),
      exists: fs.existsSync,
      writeFile: fs.writeFileSync,
      spawn: () => createChild(),
      reservePort: async () => 43123,
      waitForRendererReadiness: async () => { throw new Error('renderer readiness timed out after 25ms'); },
      waitForExit: async () => 1,
      requestGracefulQuit: () => undefined,
    };
    let adapters = 0;
    const result = await smoke.runPackageSmoke({
      platform: 'darwin', releaseDir: releaseRoot, version, runtime,
      createAdapter: () => { adapters += 1; return { command: 'fixture-app', args: [], cleanup: () => undefined }; },
      readinessTimeoutMs: 25,
    });

    expect(adapters).toBe(1);
    expect(result).toMatchObject({ status: 'failed', workspace: { cleaned: true }, quit: { requested: false } });
    expect(String(result.error)).toMatch(/readiness timed out/);
    expect(fs.existsSync(path.join(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer.dmg`))).toBe(true);
  });

  it('marks an exited fixture process as a failed graceful quit without deleting the artifact directory', async () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer.dmg`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-package-smoke-exit-'));
    roots.push(workspace);
    const child = Object.assign(new EventEmitter(), { exitCode: 1, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => undefined });
    const result = await smoke.runPackageSmoke({
      platform: 'darwin', releaseDir: releaseRoot, version,
      runtime: {
        mkdtemp: () => workspace, rm: (target: string) => fs.rmSync(target, { recursive: true, force: true }), exists: fs.existsSync, writeFile: fs.writeFileSync,
        spawn: () => child, reservePort: async () => 43124, waitForRendererReadiness: async () => [{ type: 'page', url: 'file:///index.html' }],
        requestGracefulQuit: () => undefined, waitForExit: async () => 1,
      },
      createAdapter: () => ({ command: 'fixture-app', args: [], cleanup: () => undefined }),
    });

    expect(result).toMatchObject({ status: 'failed', workspace: { cleaned: true }, quit: { requested: true, graceful: false, exitCode: 1 } });
    expect(fs.existsSync(path.join(releaseRoot, version, `FriendLauncher-Mac-${version}-Installer.dmg`))).toBe(true);
  });

  it('runs Linux AppImage smoke without depending on FUSE availability', async () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `FriendLauncher-Linux-${version}.AppImage`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-package-smoke-linux-'));
    roots.push(workspace);
    const child = Object.assign(new EventEmitter(), { exitCode: 0, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => undefined });
    let spawnEnvironment: NodeJS.ProcessEnv | undefined;
    const result = await smoke.runPackageSmoke({
      platform: 'linux', hostPlatform: 'linux', releaseDir: releaseRoot, version,
      runtime: {
        mkdtemp: () => workspace, rm: (target: string) => fs.rmSync(target, { recursive: true, force: true }), exists: fs.existsSync, writeFile: fs.writeFileSync,
        spawn: (_command: string, _args: string[], options: { env: NodeJS.ProcessEnv }) => { spawnEnvironment = options.env; return child; },
        reservePort: async () => 43125, waitForRendererReadiness: async () => [{ type: 'page', url: 'file:///index.html' }],
        requestGracefulQuit: () => undefined, waitForExit: async () => 0,
      },
      createAdapter: () => ({ command: 'fixture.AppImage', args: [], cleanup: () => undefined }),
    });

    expect(result).toMatchObject({ status: 'passed', quit: { graceful: true, exitCode: 0 } });
    expect(spawnEnvironment?.APPIMAGE_EXTRACT_AND_RUN).toBe('1');
  });

  it('reports a missing host artifact as unsupported instead of pretending a source build is smoke evidence', async () => {
    const releaseRoot = createRelease('0.7.1');
    roots.push(releaseRoot);

    await expect(smoke.runPackageSmoke({ platform: 'darwin', releaseDir: releaseRoot, version: '0.7.1' }))
      .resolves.toMatchObject({ status: 'unsupported-runner', artifact: { kind: 'none' }, workspace: { cleaned: true } });
  });

  it('writes schema-valid machine output without relying on npm stdout', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fmcl-package-smoke-output-'));
    roots.push(root);
    const output = path.join(root, 'package-smoke.json');
    const result = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts/package-smoke.js'), '--fixture-unsupported-platform', '--output', output], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toMatchObject({ status: 'unsupported-runner' });
    expect(JSON.parse(result.stdout)).toEqual(JSON.parse(fs.readFileSync(output, 'utf8')));
  });
});
