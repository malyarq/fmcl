#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, get as httpGet } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const LOG_LIMIT = 64 * 1024;
const READY_TIMEOUT_MS = 30_000;
const QUIT_TIMEOUT_MS = 15_000;
const CLEANUP_TIMEOUT_MS = 5_000;
const packageSmokeSchema = JSON.parse(readFileSync(join(projectRoot, 'quality/schemas/package-smoke.schema.json'), 'utf8'));

function expectedArtifactName(version, platform) {
  switch (platform) {
    case 'darwin': return `FriendLauncher-Mac-${version}-Installer.dmg`;
    case 'win32': return `FriendLauncher-Windows-${version}-Setup.exe`;
    case 'linux': return `FriendLauncher-Linux-${version}.AppImage`;
    default: throw new Error(`unsupported platform: ${platform}`);
  }
}

function artifactKind(platform) {
  return platform === 'darwin' ? 'dmg' : platform === 'win32' ? 'nsis' : platform === 'linux' ? 'appimage' : 'none';
}

function ensureInside(parent, target) {
  const child = resolve(target);
  const root = resolve(parent);
  if (child !== root && !child.startsWith(`${root}${sep}`)) throw new Error('source-path artifact candidates are not allowed');
  return child;
}

export function findPackagedArtifact({ releaseDir, version, platform }) {
  const resolvedReleaseDir = resolve(releaseDir);
  const artifactDirectory = ensureInside(releaseDir, resolvedReleaseDir.endsWith(`${sep}${version}`) ? resolvedReleaseDir : join(resolvedReleaseDir, version));
  const expectedName = expectedArtifactName(version, platform);
  if (!existsSync(artifactDirectory)) throw new Error(`missing release directory for ${platform}: ${artifactDirectory}`);
  const matches = readdirSync(artifactDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === expectedName)
    .map((entry) => join(artifactDirectory, entry.name));
  if (matches.length !== 1) throw new Error(`missing exact ${platform} package artifact: ${expectedName}`);
  return { path: matches[0], kind: artifactKind(platform), platform };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validatePackageSmokeEvidence(value) {
  const errors = [];
  if (!isObject(value)) return { valid: false, errors: ['evidence must be an object'] };
  const evidence = value;
  const has = (key) => Object.prototype.hasOwnProperty.call(evidence, key);
  for (const key of packageSmokeSchema.required) if (!has(key)) errors.push(`missing ${key}`);
  if (evidence.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!['passed', 'failed', 'unsupported-runner'].includes(evidence.status)) errors.push('invalid status');
  if (!['darwin', 'win32', 'linux'].includes(evidence.platform)) errors.push('invalid platform');
  if (typeof evidence.version !== 'string' || evidence.version.length === 0) errors.push('invalid version');
  if (!isObject(evidence.artifact) || typeof evidence.artifact.path !== 'string' || !['dmg', 'nsis', 'appimage', 'none'].includes(evidence.artifact.kind) || typeof evidence.artifact.sha256 !== 'string') errors.push('invalid artifact');
  if (!isObject(evidence.signing) || !['signed', 'unsigned', 'not-checked'].includes(evidence.signing.status)) errors.push('invalid signing');
  if (!isObject(evidence.workspace) || typeof evidence.workspace.cleanUserData !== 'boolean' || typeof evidence.workspace.cleaned !== 'boolean') errors.push('invalid workspace');
  if (!isObject(evidence.launch) || typeof evidence.launch.command !== 'string' || typeof evidence.launch.readiness !== 'string' || !Number.isInteger(evidence.launch.windowCount) || typeof evidence.launch.startedAt !== 'string') errors.push('invalid launch');
  if (!isObject(evidence.quit) || typeof evidence.quit.requested !== 'boolean' || typeof evidence.quit.graceful !== 'boolean' || !(Number.isInteger(evidence.quit.exitCode) || evidence.quit.exitCode === null)) errors.push('invalid quit');
  if (!isObject(evidence.logs) || typeof evidence.logs.stdout !== 'string' || typeof evidence.logs.stderr !== 'string') errors.push('invalid logs');
  return { valid: errors.length === 0, errors };
}

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function appendLog(current, chunk) {
  const next = `${current}${chunk.toString()}`;
  return next.length > LOG_LIMIT ? next.slice(-LOG_LIMIT) : next;
}

function reservePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('could not reserve loopback port'));
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

function readDebugTargets(port) {
  return new Promise((resolveTargets, reject) => {
    const request = httpGet(`http://127.0.0.1:${port}/json/list`, { timeout: 1_500 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.once('end', () => {
        try { resolveTargets(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.once('timeout', () => request.destroy(new Error('debug endpoint timeout')));
    request.once('error', reject);
  });
}

export function requestDebugTargetClose(port, targetId) {
  return new Promise((resolveClose, reject) => {
    const request = httpGet(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(targetId)}`, { timeout: 1_500 }, (response) => {
      response.resume();
      if (response.statusCode === 200) resolveClose();
      else reject(new Error(`debug target close failed with HTTP ${response.statusCode ?? 'unknown'}`));
    });
    request.once('timeout', () => request.destroy(new Error('debug target close timeout')));
    request.once('error', reject);
  });
}

export function requestPlatformQuit({ platform, child, debugPort, pages }) {
  if (platform === 'darwin') return child.kill('SIGTERM');
  const target = pages.find((page) => typeof page?.id === 'string' && page.id.length > 0);
  if (!target) throw new Error(`${platform} graceful quit requires a renderer debug target`);
  return requestDebugTargetClose(debugPort, target.id);
}

async function waitForRendererReadiness(port, timeoutMs = READY_TIMEOUT_MS, hasExited = () => false) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (hasExited()) throw new Error('packaged process exited before renderer readiness');
    try {
      const targets = await readDebugTargets(port);
      const pages = Array.isArray(targets) ? targets.filter((target) => target?.type === 'page' && typeof target.url === 'string' && target.url.length > 0) : [];
      if (pages.length === 1) return pages;
    } catch {
      // Electron has not opened its local DevTools endpoint yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error(`renderer readiness timed out after ${timeoutMs}ms`);
}

function waitForExit(child, timeoutMs = QUIT_TIMEOUT_MS) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise((resolveExit, reject) => {
    const timer = setTimeout(() => reject(new Error(`graceful quit timed out after ${timeoutMs}ms`)), timeoutMs);
    child.once('exit', (code) => { clearTimeout(timer); resolveExit(code); });
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

function releaseChildHandles(child) {
  child?.stdout?.destroy?.();
  child?.stderr?.destroy?.();
  child?.stdin?.destroy?.();
  child?.unref?.();
}

async function stopChildIfRunning(child, runtime) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  child.kill('SIGTERM');
  try {
    await runtime.waitForExit(child, CLEANUP_TIMEOUT_MS);
  } catch {
    child.kill('SIGKILL');
    try { await runtime.waitForExit(child, CLEANUP_TIMEOUT_MS); } catch { /* handles are released below */ }
  }
}

function findSingleApp(root) {
  const apps = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
  if (apps.length !== 1) throw new Error(`DMG must contain exactly one .app bundle (found ${apps.length})`);
  return join(root, apps[0].name);
}

function macAdapter({ artifactPath, workspace, ports }) {
  const mountPath = join(workspace, 'mounted-dmg');
  const copiedApp = join(workspace, 'FriendLauncher.app');
  ports.mkdir(mountPath);
  ports.execFile('hdiutil', ['attach', artifactPath, '-nobrowse', '-readonly', '-mountpoint', mountPath]);
  try {
    const mountedApp = findSingleApp(mountPath);
    ports.copyBundle(mountedApp, copiedApp);
  } finally {
    // Run the extracted bundle, never the mounted disk image, so cleanup does
    // not block on an otherwise healthy launcher process.
    ports.execFile('hdiutil', ['detach', mountPath, '-force']);
  }
  const executable = join(copiedApp, 'Contents', 'MacOS', 'FriendLauncher');
  if (!ports.exists(executable)) throw new Error(`mounted app has no expected executable: ${executable}`);
  return {
    command: executable,
    args: [],
    cleanup: () => undefined,
  };
}

function windowsAdapter({ artifactPath, workspace, ports }) {
  const installDir = join(workspace, 'installed');
  ports.mkdir(installDir);
  ports.execFile(artifactPath, ['/S', `/D=${installDir}`]);
  const executable = join(installDir, 'FriendLauncher.exe');
  if (!ports.exists(executable)) throw new Error(`NSIS installer has no expected executable: ${executable}`);
  return {
    command: executable,
    args: [],
    cleanup: () => undefined,
  };
}

function linuxAdapter({ artifactPath, ports }) {
  ports.chmod(artifactPath, 0o755);
  return { command: artifactPath, args: [], cleanup: () => undefined };
}

export function createPlatformAdapter(platform, options) {
  if (platform === 'darwin') return macAdapter(options);
  if (platform === 'win32') return windowsAdapter(options);
  if (platform === 'linux') return linuxAdapter(options);
  throw new Error(`unsupported platform: ${platform}`);
}

function defaultPorts() {
  return {
    exists: existsSync,
    mkdir: (target) => mkdirSync(target, { recursive: true }),
    copyBundle: (from, to) => execFileSync('ditto', [from, to], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
    chmod: chmodSync,
    execFile: (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
  };
}

function makeDirectory(target) {
  mkdirSync(target, { recursive: true });
}

function defaultRuntime() {
  return {
    mkdtemp: mkdtempSync,
    rm: rmSync,
    exists: existsSync,
    writeFile: writeFileSync,
    spawn,
    reservePort,
    waitForRendererReadiness: (port, timeoutMs, child) => waitForRendererReadiness(port, timeoutMs, () => child.exitCode !== null),
    waitForExit,
    requestGracefulQuit: requestPlatformQuit,
  };
}

export async function runPackageSmoke(options = {}) {
  const platform = options.platform ?? process.platform;
  const hostPlatform = options.hostPlatform ?? process.platform;
  const version = options.version ?? JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).version;
  const releaseDir = options.releaseDir ?? join(projectRoot, 'release');
  const ports = { ...defaultPorts(), ...(options.ports ?? {}), mkdir: options.ports?.mkdir ?? makeDirectory };
  const runtime = { ...defaultRuntime(), ...(options.runtime ?? {}) };
  const startedAt = new Date().toISOString();
  const evidence = {
    schemaVersion: 1,
    status: 'failed',
    platform: ['darwin', 'win32', 'linux'].includes(platform) ? platform : 'darwin',
    version,
    artifact: { path: '', kind: 'none', sha256: '' },
    signing: { status: 'not-checked' },
    workspace: { cleanUserData: true, cleaned: false },
    launch: { command: '', readiness: 'not-started', windowCount: 0, startedAt },
    quit: { requested: false, graceful: false, exitCode: null },
    logs: { stdout: '', stderr: '' },
  };
  let workspace = null;
  let child = null;
  let adapter = null;
  try {
    if (!['darwin', 'win32', 'linux'].includes(platform)) {
      evidence.status = 'unsupported-runner';
      evidence.error = `unsupported runner platform: ${platform}`;
      return evidence;
    }
    const artifact = findPackagedArtifact({ releaseDir, version, platform });
    evidence.artifact = { path: relative(releaseDir, artifact.path), kind: artifact.kind, sha256: sha256(artifact.path) };
    if (platform === 'darwin' && hostPlatform !== 'darwin') throw new Error('unsupported runner: DMG packages require a macOS host');
    if (platform === 'win32' && hostPlatform !== 'win32') throw new Error('unsupported runner: NSIS packages require a Windows host');
    if (platform === 'linux' && hostPlatform !== 'linux') throw new Error('unsupported runner: AppImage packages require a Linux host');
    workspace = runtime.mkdtemp(join(tmpdir(), 'fmcl-package-smoke-'));
    const userDataPath = join(workspace, 'user-data');
    const configPath = join(workspace, 'package-smoke-config.json');
    makeDirectory(userDataPath);
    // The canonical launcher root is intentionally empty but must exist before
    // operation recovery probes its real path on a clean first start.
    makeDirectory(join(userDataPath, 'minecraft_data'));
    runtime.writeFile(configPath, JSON.stringify({ cleanUserData: true, artifact: basename(artifact.path), version, platform }), 'utf8');
    adapter = (options.createAdapter ?? createPlatformAdapter)(platform, { artifactPath: artifact.path, workspace, ports });
    const debugPort = await runtime.reservePort();
    child = runtime.spawn(adapter.command, [...adapter.args, `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataPath}`], {
      cwd: workspace,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FMCL_TEST_USER_DATA: userDataPath,
        FMCL_PACKAGE_SMOKE_CONFIG: configPath,
        ELECTRON_ENABLE_LOGGING: '1',
        ...(platform === 'linux' ? { APPIMAGE_EXTRACT_AND_RUN: '1' } : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });
    evidence.launch.command = basename(adapter.command);
    child.stdout.on('data', (chunk) => { evidence.logs.stdout = appendLog(evidence.logs.stdout, chunk); });
    child.stderr.on('data', (chunk) => { evidence.logs.stderr = appendLog(evidence.logs.stderr, chunk); });
    const pages = await runtime.waitForRendererReadiness(
      debugPort,
      options.readinessTimeoutMs ?? READY_TIMEOUT_MS,
      child,
    );
    evidence.launch.readiness = 'remote-debugging-page';
    evidence.launch.windowCount = pages.length;
    evidence.quit.requested = true;
    await runtime.requestGracefulQuit({ platform, child, debugPort, pages });
    evidence.quit.exitCode = await runtime.waitForExit(child, options.quitTimeoutMs ?? QUIT_TIMEOUT_MS);
    evidence.quit.graceful = evidence.quit.exitCode === 0;
    if (!evidence.quit.graceful) throw new Error(`packaged process exited abnormally: ${evidence.quit.exitCode}`);
    evidence.status = 'passed';
  } catch (error) {
    evidence.error = error instanceof Error ? error.message : String(error);
    if (/^unsupported runner:/.test(String(evidence.error))) evidence.status = 'unsupported-runner';
  } finally {
    await stopChildIfRunning(child, runtime);
    try { adapter?.cleanup?.(); } catch (error) { evidence.logs.stderr = appendLog(evidence.logs.stderr, `cleanup: ${String(error)}\n`); }
    if (workspace) {
      const workspaceAliases = [workspace];
      try { workspaceAliases.push(realpathSync(workspace)); } catch { /* workspace may already be removed */ }
      runtime.rm(workspace, { recursive: true, force: true });
      evidence.workspace.cleaned = !runtime.exists(workspace);
      for (const workspacePath of workspaceAliases) {
        evidence.logs.stdout = evidence.logs.stdout.split(workspacePath).join('<smoke-workspace>');
        evidence.logs.stderr = evidence.logs.stderr.split(workspacePath).join('<smoke-workspace>');
        if (typeof evidence.error === 'string') evidence.error = evidence.error.split(workspacePath).join('<smoke-workspace>');
      }
    } else evidence.workspace.cleaned = true;
    // AppImage can leave Chromium helpers holding inherited stdio after the
    // main process exits. Do not let those stale handles pin the smoke runner.
    releaseChildHandles(child);
  }
  return evidence;
}

function printHelp() {
  console.log('Usage: node scripts/package-smoke.js [--release-dir <dir>] [--version <version>] [--output <file>] [--fixture-unsupported-platform]');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return printHelp();
  const valueAfter = (flag) => args[args.indexOf(flag) + 1];
  const result = await runPackageSmoke({
    releaseDir: args.includes('--release-dir') ? valueAfter('--release-dir') : undefined,
    version: args.includes('--version') ? valueAfter('--version') : undefined,
    platform: args.includes('--fixture-unsupported-platform') ? 'freebsd' : undefined,
  });
  const validation = validatePackageSmokeEvidence(result);
  if (!validation.valid) throw new Error(`invalid package-smoke evidence: ${validation.errors.join(', ')}`);
  if (args.includes('--output')) {
    const output = resolve(projectRoot, valueAfter('--output'));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'failed' || (result.status === 'unsupported-runner' && !args.includes('--fixture-unsupported-platform'))) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
