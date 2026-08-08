import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';

type PackageSmoke = Readonly<{
  findPackagedArtifact(options: Readonly<{ releaseDir: string; version: string; platform: NodeJS.Platform }>): Readonly<{ path: string; kind: string; platform: string }>;
  validatePackageSmokeEvidence(value: unknown): Readonly<{ valid: boolean; errors: string[] }>;
  assertRenderedVersion(value: unknown, expectedVersion: string, options?: Readonly<{ allowMissingMarker?: boolean }>): void;
  createPlatformAdapter(platform: NodeJS.Platform, options: unknown): Readonly<{ command: string; args: string[]; cleanup(): void }>;
  requestPlatformQuit(options: unknown): Promise<void> | boolean;
  runPackageSmoke(options: unknown): Promise<Record<string, unknown>>;
}>;

const require = createRequire(import.meta.url);
const smoke = require('../package-smoke.js') as PackageSmoke;

function createRelease(version = '0.7.1'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-package-smoke-'));
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
    writeArtifact(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`);
    writeArtifact(releaseRoot, version, `Burrow-Windows-${version}-Setup.exe`);
    writeArtifact(releaseRoot, version, `Burrow-Linux-${version}.AppImage`);

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
    writeArtifact(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`);

    expect(smoke.findPackagedArtifact({ releaseDir: path.join(releaseRoot, version), version, platform: 'darwin' })).toMatchObject({
      kind: 'dmg', platform: 'darwin', path: expect.stringMatching(new RegExp(`${version}-Installer\\.dmg$`)),
    });
  });

  it('rejects missing, duplicate and source artifacts before process launch', () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);

    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'darwin' })).toThrow(/missing/i);
    writeArtifact(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`);
    writeArtifact(releaseRoot, version, `Burrow-Mac-${version}-Installer (copy).dmg`);
    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'darwin' })).not.toThrow();
    fs.writeFileSync(path.join(releaseRoot, version, 'Burrow-Mac-0.7.1-Installer.dmg'), 'fixture');
    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'darwin' })).not.toThrow();
    expect(() => smoke.findPackagedArtifact({ releaseDir: releaseRoot, version, platform: 'freebsd' })).toThrow(/unsupported/i);
  });

  it('accepts complete packaged evidence and rejects incomplete quit/log evidence', () => {
    const complete = {
      schemaVersion: 1,
      status: 'passed',
      platform: 'darwin',
      version: '0.7.1',
      artifact: { path: 'Burrow-Mac-0.7.1-Installer.dmg', kind: 'dmg', sha256: 'a'.repeat(64) },
      signing: { status: 'not-checked' },
      workspace: { cleanUserData: true, cleaned: true },
      launch: { command: 'Burrow', readiness: 'remote-debugging-page', windowCount: 1, startedAt: '2026-08-05T00:00:00.000Z' },
      quit: { requested: true, graceful: true, exitCode: 0 },
      logs: { stdout: '', stderr: '' },
    };

    expect(smoke.validatePackageSmokeEvidence(complete)).toEqual({ valid: true, errors: [] });
    const withoutSigning = { ...complete };
    delete withoutSigning.signing;
    expect(smoke.validatePackageSmokeEvidence(withoutSigning)).toMatchObject({ valid: false });
    expect(smoke.validatePackageSmokeEvidence({ ...complete, quit: { requested: true } })).toMatchObject({ valid: false });
    expect(smoke.validatePackageSmokeEvidence({ ...complete, logs: { stdout: '' } })).toMatchObject({ valid: false });
    const incompleteUpgrade = {
      ...complete,
      upgrade: {
        attempted: true,
        previousVersion: '0.7.0',
        previousArtifactSha256: 'b'.repeat(64),
        previousLaunchVerified: false,
        userDataPreserved: true,
      },
    };
    expect(smoke.validatePackageSmokeEvidence(incompleteUpgrade)).toMatchObject({ valid: false });
    expect(smoke.validatePackageSmokeEvidence({ ...incompleteUpgrade, status: 'failed' })).toEqual({ valid: true, errors: [] });
  });

  it('accepts a missing version marker only for an exact legacy upgrade artifact', () => {
    expect(() => smoke.assertRenderedVersion(null, '0.9.1', { allowMissingMarker: true })).not.toThrow();
    expect(() => smoke.assertRenderedVersion('0.9.0', '0.9.1', { allowMissingMarker: true })).toThrow(/version mismatch/i);
    expect(() => smoke.assertRenderedVersion(null, '0.10.0')).toThrow(/version mismatch/i);
  });

  it('constructs native adapter commands through injected filesystem ports', () => {
    const root = createRelease();
    roots.push(root);
    const calls: string[] = [];
    const macMount = path.join(root, 'workspace', 'mounted-dmg');
    fs.mkdirSync(path.join(macMount, 'Burrow.app', 'Contents', 'MacOS'), { recursive: true });
    fs.writeFileSync(path.join(macMount, 'Burrow.app', 'Contents', 'MacOS', 'Burrow'), 'fixture');
    const ports = {
      mkdir: (target: string) => fs.mkdirSync(target, { recursive: true }),
      exists: fs.existsSync,
      copyBundle: (from: string, to: string) => { calls.push(`copy:${from}:${to}`); fs.cpSync(from, to, { recursive: true }); },
      execFile: (command: string, args: string[]) => { calls.push(`${command}:${args.join(' ')}`); },
      chmod: (target: string, mode: number) => calls.push(`chmod:${target}:${mode.toString(8)}`),
    };
    const mac = smoke.createPlatformAdapter('darwin', { artifactPath: '/artifacts/Burrow-Mac-0.7.1-Installer.dmg', workspace: path.join(root, 'workspace'), ports });
    const win = smoke.createPlatformAdapter('win32', {
      artifactPath: '/artifacts/Burrow-Windows-0.7.1-Setup.exe', workspace: path.join(root, 'windows'),
      ports: { ...ports, exists: (target: string) => target.endsWith('Burrow.exe') },
    });
    const linux = smoke.createPlatformAdapter('linux', { artifactPath: '/artifacts/Burrow-Linux-0.7.1.AppImage', workspace: path.join(root, 'linux'), ports });
    win.cleanup();

    expect(mac.command).toMatch(/Burrow\.app\/Contents\/MacOS\/Burrow$/);
    expect(win.command).toMatch(/installed[\\/]Burrow\.exe$/);
    expect(linux).toMatchObject({ command: '/artifacts/Burrow-Linux-0.7.1.AppImage', args: [] });
    expect(calls).toEqual(expect.arrayContaining([
      expect.stringContaining('hdiutil:attach'),
      expect.stringContaining('hdiutil:detach'),
      expect.stringContaining('Burrow-Windows-0.7.1-Setup.exe:/S'),
      expect.stringMatching(/^powershell\.exe:.*GetFullPath\('.*installed'\).*Win32_Process/),
      expect.stringContaining('chmod:/artifacts/Burrow-Linux-0.7.1.AppImage:755'),
    ]));
    const powershellCall = calls.find((call) => call.startsWith('powershell.exe:'));
    expect(powershellCall).toContain("$root = [IO.Path]::GetFullPath('");
    expect(powershellCall).toContain("$workspace = [IO.Path]::GetFullPath('");
    expect(powershellCall).toContain('CommandLine.IndexOf($workspace');
    expect(powershellCall).toContain('$_.ProcessId -ne $PID');
    expect(powershellCall).not.toContain('$args[0]');
    expect(powershellCall).not.toContain('{;');
  });

  it.each(['win32', 'linux'] as const)('requests a real window close for %s instead of force-killing Electron', async (platform) => {
    let requestedPath = '';
    const server = createServer((request, response) => {
      requestedPath = request.url ?? '';
      response.writeHead(200).end('Target is closing');
    });
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('test server has no TCP address');
    let killed = false;

    try {
      await smoke.requestPlatformQuit({
        platform,
        child: { kill: () => { killed = true; } },
        debugPort: address.port,
        pages: [{ id: 'renderer/page' }],
      });
    } finally {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    }

    expect(requestedPath).toBe('/json/close/renderer%2Fpage');
    expect(killed).toBe(false);
  });

  it('records readiness timeout and abnormal exit with fake process ports while retaining the caller release directory', async () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-package-smoke-runtime-'));
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
      verifyRenderedVersion: async () => undefined,
      waitForExit: async () => 1,
      requestGracefulQuit: () => undefined,
    };
    let adapters = 0;
    const result = await smoke.runPackageSmoke({
      platform: 'darwin', hostPlatform: 'darwin', releaseDir: releaseRoot, version, runtime,
      createAdapter: () => { adapters += 1; return { command: 'fixture-app', args: [], cleanup: () => undefined }; },
      readinessTimeoutMs: 25,
    });

    expect(adapters).toBe(1);
    expect(result).toMatchObject({ status: 'failed', workspace: { cleaned: true }, quit: { requested: false } });
    expect(String(result.error)).toMatch(/readiness timed out/);
    expect(fs.existsSync(path.join(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`))).toBe(true);
  });

  it('marks an exited fixture process as a failed graceful quit without deleting the artifact directory', async () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-package-smoke-exit-'));
    roots.push(workspace);
    const child = Object.assign(new EventEmitter(), { exitCode: 1, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => undefined });
    const result = await smoke.runPackageSmoke({
      platform: 'darwin', hostPlatform: 'darwin', releaseDir: releaseRoot, version,
      runtime: {
        mkdtemp: () => workspace, rm: (target: string) => fs.rmSync(target, { recursive: true, force: true }), exists: fs.existsSync, writeFile: fs.writeFileSync,
        spawn: () => child, reservePort: async () => 43124, waitForRendererReadiness: async () => [{ type: 'page', url: 'file:///index.html' }],
        verifyRenderedVersion: async () => undefined,
        requestGracefulQuit: () => undefined, waitForExit: async () => 1,
      },
      createAdapter: () => ({ command: 'fixture-app', args: [], cleanup: () => undefined }),
    });

    expect(result).toMatchObject({ status: 'failed', workspace: { cleaned: true }, quit: { requested: true, graceful: false, exitCode: 1 } });
    expect(fs.existsSync(path.join(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`))).toBe(true);
  });

  it('launches the previous package, upgrades in place, and preserves user data before passing', async () => {
    const version = '0.9.2';
    const previousVersion = '0.9.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `Burrow-Mac-${version}-Installer.dmg`);
    const previousArtifact = path.join(releaseRoot, `FriendLauncher-Mac-${previousVersion}-Installer.dmg`);
    fs.writeFileSync(previousArtifact, 'previous fixture');
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-package-smoke-upgrade-'));
    roots.push(workspace);
    const verifiedVersions: Array<[string, unknown]> = [];
    const spawnedEnvironments: NodeJS.ProcessEnv[] = [];
    const waitForProfileRelease = vi.fn().mockResolvedValue(undefined);
    const removeWorkspace = vi.fn((target: string) => fs.rmSync(target, { recursive: true, force: true }));
    let port = 44000;
    const createChild = () => Object.assign(new EventEmitter(), {
      exitCode: 0, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => undefined,
    });

    const result = await smoke.runPackageSmoke({
      platform: 'darwin', hostPlatform: 'darwin', releaseDir: releaseRoot, version,
      previousArtifactPath: previousArtifact, previousVersion,
      runtime: {
        mkdtemp: () => workspace,
        rm: removeWorkspace,
        exists: fs.existsSync,
        writeFile: fs.writeFileSync,
        spawn: (_command: string, _args: string[], options: { env: NodeJS.ProcessEnv }) => {
          spawnedEnvironments.push(options.env);
          return createChild();
        },
        reservePort: async () => { port += 1; return port; },
        waitForRendererReadiness: async () => [{ type: 'page', url: 'file:///index.html' }],
        verifyRenderedVersion: async (_page: unknown, expectedVersion: string, options: unknown) => { verifiedVersions.push([expectedVersion, options]); },
        waitForProfileRelease,
        requestGracefulQuit: () => undefined,
        waitForExit: async () => 0,
      },
      createAdapter: (_platform: string, options: { artifactPath: string; productName: string }) => ({
        command: options.artifactPath,
        args: [],
        cleanup: () => undefined,
      }),
    });

    expect(result).toMatchObject({
      status: 'passed',
      upgrade: {
        attempted: true,
        previousVersion,
        previousArtifactSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        previousLaunchVerified: true,
        userDataPreserved: true,
      },
    });
    expect(verifiedVersions).toEqual([
      [previousVersion, { allowMissingMarker: true }],
      [version, undefined],
    ]);
    expect(spawnedEnvironments[0]).toMatchObject({
      BURROW_TEST_USER_DATA: path.join(workspace, 'user-data'),
      BURROW_PACKAGE_SMOKE_CONFIG: path.join(workspace, 'package-smoke-config.json'),
      FMCL_TEST_USER_DATA: path.join(workspace, 'user-data'),
      FMCL_PACKAGE_SMOKE_CONFIG: path.join(workspace, 'package-smoke-config.json'),
    });
    expect(spawnedEnvironments[1]).toMatchObject({
      BURROW_TEST_USER_DATA: path.join(workspace, 'user-data'),
      BURROW_PACKAGE_SMOKE_CONFIG: path.join(workspace, 'package-smoke-config.json'),
    });
    expect(spawnedEnvironments[1]).not.toHaveProperty('FMCL_TEST_USER_DATA');
    expect(waitForProfileRelease).toHaveBeenCalledTimes(2);
    expect(smoke.productNameForArtifact(previousArtifact, previousVersion, 'darwin')).toBe('FriendLauncher');
    expect(waitForProfileRelease).toHaveBeenNthCalledWith(1, path.join(workspace, 'user-data'), 5_000);
    expect(waitForProfileRelease).toHaveBeenNthCalledWith(2, path.join(workspace, 'user-data'), 5_000);
    expect(removeWorkspace).toHaveBeenCalledWith(workspace, {
      recursive: true,
      force: true,
      maxRetries: 25,
      retryDelay: 200,
    });
    expect(smoke.validatePackageSmokeEvidence(result)).toEqual({ valid: true, errors: [] });
  });

  it('returns valid failed evidence when a locked workspace survives cleanup', async () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `Burrow-Windows-${version}-Setup.exe`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-package-smoke-locked-'));
    roots.push(workspace);
    const removeWorkspace = vi.fn(() => { throw Object.assign(new Error('locked'), { code: 'EPERM' }); });
    const child = Object.assign(new EventEmitter(), {
      exitCode: 0,
      stdout: Object.assign(new EventEmitter(), { destroy: vi.fn() }),
      stderr: Object.assign(new EventEmitter(), { destroy: vi.fn() }),
      kill: () => undefined,
      unref: vi.fn(),
    });

    const result = await smoke.runPackageSmoke({
      platform: 'win32', hostPlatform: 'win32', releaseDir: releaseRoot, version,
      runtime: {
        mkdtemp: () => workspace,
        rm: removeWorkspace,
        exists: fs.existsSync,
        writeFile: fs.writeFileSync,
        spawn: () => child,
        reservePort: async () => 43126,
        waitForRendererReadiness: async () => [{ type: 'page', url: 'file:///index.html' }],
        verifyRenderedVersion: async () => undefined,
        waitForProfileRelease: async () => undefined,
        requestGracefulQuit: () => undefined,
        waitForExit: async () => 0,
      },
      createAdapter: () => ({ command: 'fixture.exe', args: [], cleanup: () => undefined }),
    });

    expect(result).toMatchObject({
      status: 'failed',
      workspace: { cleaned: false },
      error: expect.stringMatching(/workspace cleanup failed/i),
    });
    expect(removeWorkspace).toHaveBeenCalledWith(workspace, {
      recursive: true,
      force: true,
      maxRetries: 75,
      retryDelay: 200,
    });
    expect(smoke.validatePackageSmokeEvidence(result)).toEqual({ valid: true, errors: [] });
  });

  it('runs Linux AppImage smoke without depending on FUSE availability', async () => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, `Burrow-Linux-${version}.AppImage`);
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-package-smoke-linux-'));
    roots.push(workspace);
    const stdout = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    const stderr = Object.assign(new EventEmitter(), { destroy: vi.fn() });
    const child = Object.assign(new EventEmitter(), {
      exitCode: 0, stdout, stderr, kill: () => undefined, unref: vi.fn(),
    });
    let spawnEnvironment: NodeJS.ProcessEnv | undefined;
    let spawnCwd: string | undefined;
    const result = await smoke.runPackageSmoke({
      platform: 'linux', hostPlatform: 'linux', releaseDir: releaseRoot, version,
      runtime: {
        mkdtemp: () => workspace, rm: (target: string) => fs.rmSync(target, { recursive: true, force: true }), exists: fs.existsSync, writeFile: fs.writeFileSync,
        spawn: (_command: string, _args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => {
          spawnCwd = options.cwd;
          spawnEnvironment = options.env;
          return child;
        },
        reservePort: async () => 43125, waitForRendererReadiness: async () => [{ type: 'page', url: 'file:///index.html' }],
        verifyRenderedVersion: async () => undefined,
        requestGracefulQuit: () => undefined, waitForExit: async () => 0,
      },
      createAdapter: () => ({ command: 'fixture.AppImage', args: [], cleanup: () => undefined }),
    });

    expect(result).toMatchObject({ status: 'passed', quit: { graceful: true, exitCode: 0 } });
    expect(spawnCwd).toBe(os.tmpdir());
    expect(spawnEnvironment?.APPIMAGE_EXTRACT_AND_RUN).toBe('1');
    expect(stdout.destroy).toHaveBeenCalledOnce();
    expect(stderr.destroy).toHaveBeenCalledOnce();
    expect(child.unref).toHaveBeenCalledOnce();
  });

  it.each([
    ['darwin', 'linux', `Burrow-Mac-0.7.1-Installer.dmg`, 'dmg'],
    ['linux', 'win32', `Burrow-Linux-0.7.1.AppImage`, 'appimage'],
    ['win32', 'darwin', `Burrow-Windows-0.7.1-Setup.exe`, 'nsis'],
  ] as const)('binds %s foreign-runner evidence to the artifact without invoking an adapter', async (platform, hostPlatform, artifactName, kind) => {
    const version = '0.7.1';
    const releaseRoot = createRelease(version);
    roots.push(releaseRoot);
    writeArtifact(releaseRoot, version, artifactName);
    let adapters = 0;

    const result = await smoke.runPackageSmoke({
      platform, hostPlatform, releaseDir: releaseRoot, version,
      createAdapter: () => { adapters += 1; return { command: 'must-not-run', args: [], cleanup: () => undefined }; },
    });

    expect(adapters).toBe(0);
    expect(result).toMatchObject({
      status: 'unsupported-runner',
      platform,
      artifact: { kind, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) },
      workspace: { cleaned: true },
    });
  });

  it('reports a missing package as failed instead of emitting unbound unsupported evidence', async () => {
    const releaseRoot = createRelease('0.7.1');
    roots.push(releaseRoot);

    await expect(smoke.runPackageSmoke({ platform: 'darwin', releaseDir: releaseRoot, version: '0.7.1' }))
      .resolves.toMatchObject({ status: 'failed', artifact: { kind: 'none', sha256: '' }, workspace: { cleaned: true } });
  });

  it('writes schema-valid machine output without relying on npm stdout', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-package-smoke-output-'));
    roots.push(root);
    const output = path.join(root, 'package-smoke.json');
    const result = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts/package-smoke.js'), '--fixture-unsupported-platform', '--output', output], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(output, 'utf8'))).toMatchObject({ status: 'unsupported-runner' });
    expect(JSON.parse(result.stdout)).toEqual(JSON.parse(fs.readFileSync(output, 'utf8')));
  });
});
