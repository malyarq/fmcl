#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const schemaPath = join(projectRoot, 'quality/schemas/release-evidence.schema.json');
const releaseEvidenceSchema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const PLATFORMS = ['darwin', 'linux', 'win32'];
const ARTIFACT_PLATFORMS = [...PLATFORMS, 'shared'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{7,40}$/i;
const ROLLBACK_ACTIONS = ['withdraw-or-mark-non-latest', 'publish-new-patch'];

const classifyReleaseAsset = (name) => {
  if (name === 'SHA256SUMS.txt') return null;
  if (/\.dmg$/i.test(name)) return { platform: 'darwin', kind: 'dmg' };
  if (/\.exe$/i.test(name)) return { platform: 'win32', kind: 'nsis' };
  if (/\.AppImage$/.test(name)) return { platform: 'linux', kind: 'appimage' };
  if (/^latest(?:-[A-Za-z0-9_-]+)?\.yml$/.test(name) || /\.blockmap$/i.test(name)) {
    return { platform: 'shared', kind: 'release-asset' };
  }
  return null;
};

function defaultFileSystem() {
  return {
    exists: existsSync,
    readFile: readFileSync,
    writeFile: writeFileSync,
    readdir: readdirSync,
    stat: statSync,
    mkdir: (target) => mkdirSync(target, { recursive: true }),
    mkdtemp: (prefix) => mkdtempSync(prefix),
    rm: (target) => rmSync(target, { recursive: true, force: true }),
    copyFile: copyFileSync,
  };
}

function defaultCommand() {
  return {
    has(command) {
      return spawnSync('which', [command], { encoding: 'utf8' }).status === 0;
    },
    run(command, args) {
      const result = spawnSync(command, args, { encoding: 'utf8' });
      return {
        status: result.status ?? 1,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? result.error?.message ?? '',
      };
    },
  };
}

function asObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function safeOutput(result, artifactPath) {
  const printable = [...`${result.stdout ?? ''}\n${result.stderr ?? ''}`]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join('');
  const combined = printable
    .replaceAll(artifactPath, '[artifact]')
    .replace(/\s+/g, ' ')
    .trim();
  return combined.slice(0, 4096);
}

function commandRecord(command, args, result, artifactPath) {
  return { command: `${command} ${args.join(' ')}`, exitCode: result.status, output: safeOutput(result, artifactPath) };
}

function unavailable(reason) {
  return { status: 'unavailable', checked: false, reason, command: null };
}

function validateCandidate(candidate) {
  const value = asObject(candidate);
  if (!value || typeof value.version !== 'string' || !SEMVER.test(value.version)) throw new Error('candidate.version must be a valid SemVer without v');
  if (value.tag !== `v${value.version}`) throw new Error('candidate.tag must exactly match candidate.version');
  if (typeof value.commit !== 'string' || !COMMIT.test(value.commit)) throw new Error('candidate.commit must be a Git SHA');
  return { version: value.version, tag: value.tag, commit: value.commit.toLowerCase() };
}

function ensureRelativeArtifactPath(root, name) {
  if (name.includes('\n') || name.includes('\r')) throw new Error('artifact names cannot contain newlines');
  const target = resolve(root, name);
  const rootPath = resolve(root);
  if (target !== rootPath && !target.startsWith(`${rootPath}${sep}`)) throw new Error(`artifact path escapes directory: ${name}`);
  return target;
}

export function enumerateReleaseArtifacts({ artifactsDir, fileSystem = defaultFileSystem() }) {
  const root = resolve(artifactsDir);
  if (!fileSystem.exists(root)) throw new Error(`artifact directory does not exist: ${root}`);
  const artifacts = fileSystem.readdir(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, supported: classifyReleaseAsset(entry.name) }))
    .filter((entry) => entry.supported !== null)
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .map(({ name, supported }) => {
      const artifactPath = ensureRelativeArtifactPath(root, name);
      const bytes = fileSystem.readFile(artifactPath);
      return {
        path: name,
        platform: supported.platform,
        kind: supported.kind,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    });
  if (artifacts.length === 0) throw new Error(`no supported release artifacts found in ${root}`);
  return artifacts;
}

export function writeSha256Sums({ artifactsDir, artifacts, fileSystem = defaultFileSystem() }) {
  const root = resolve(artifactsDir);
  const ordered = [...artifacts].sort((left, right) => left.path.localeCompare(right.path, 'en'));
  const manifest = `${ordered.map((artifact) => `${artifact.sha256}  ${artifact.path}`).join('\n')}\n`;
  const manifestPath = join(root, 'SHA256SUMS.txt');
  fileSystem.writeFile(manifestPath, manifest, 'utf8');
  return { manifestPath, contents: manifest };
}

function parseManifest(contents) {
  const records = String(contents).split('\n').filter(Boolean).map((line) => {
    const match = /^([a-f0-9]{64}) {2}([^\r\n]+)$/.exec(line);
    if (!match) throw new Error(`invalid SHA256SUMS entry: ${line}`);
    return { sha256: match[1], path: match[2] };
  });
  if (records.length === 0) throw new Error('SHA256SUMS.txt has no entries');
  const paths = records.map((record) => record.path);
  if (new Set(paths).size !== paths.length) throw new Error('SHA256SUMS.txt has duplicate artifact paths');
  if (paths.join('\n') !== [...paths].sort((left, right) => left.localeCompare(right, 'en')).join('\n')) throw new Error('SHA256SUMS.txt is not sorted');
  return records;
}

export function verifySha256Sums({ verificationDir, fileSystem = defaultFileSystem() }) {
  const root = resolve(verificationDir);
  const records = parseManifest(fileSystem.readFile(join(root, 'SHA256SUMS.txt'), 'utf8'));
  const mismatches = [];
  for (const record of records) {
    const artifactPath = ensureRelativeArtifactPath(root, record.path);
    if (!fileSystem.exists(artifactPath)) {
      mismatches.push(`${record.path}: missing`);
      continue;
    }
    const actual = createHash('sha256').update(fileSystem.readFile(artifactPath)).digest('hex');
    if (actual !== record.sha256) mismatches.push(`${record.path}: checksum mismatch`);
  }
  return { valid: mismatches.length === 0, mismatches };
}

function copyForVerification({ artifactsDir, verificationDir, artifacts, fileSystem }) {
  const source = resolve(artifactsDir);
  const destination = resolve(verificationDir);
  if (source === destination) throw new Error('verification directory must be separate from the artifact directory');
  fileSystem.mkdir(destination);
  const existing = fileSystem.readdir(destination, { withFileTypes: true });
  if (existing.length > 0) throw new Error('verification directory must start empty');
  for (const artifact of artifacts) fileSystem.copyFile(join(source, artifact.path), join(destination, artifact.path));
  fileSystem.copyFile(join(source, 'SHA256SUMS.txt'), join(destination, 'SHA256SUMS.txt'));
}

function checkMacAuthenticity(artifactPath, command) {
  if (!command.has('codesign')) return { codeSigning: unavailable('codesign is unavailable'), notarization: unavailable('codesign is unavailable') };
  const codesign = command.run('codesign', ['--verify', '--deep', '--strict', artifactPath]);
  const codeCommand = commandRecord('codesign', ['--verify', '--deep', '--strict', artifactPath], codesign, artifactPath);
  const codeOutput = codeCommand.output.toLowerCase();
  if (codesign.status !== 0 && !/(not signed|code object is not signed)/.test(codeOutput)) throw new Error('unrecognized macOS code-signing output');
  if (codesign.status !== 0) {
    return {
      codeSigning: { status: 'unsigned', checked: true, reason: 'codesign reports no signature', command: codeCommand },
      notarization: { status: 'unsigned', checked: false, reason: 'unsigned artifacts cannot be notarized', command: null },
    };
  }
  if (!command.has('spctl')) return { codeSigning: { status: 'signed', checked: true, reason: 'codesign verification passed', command: codeCommand }, notarization: unavailable('spctl is unavailable') };
  const spctl = command.run('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', artifactPath]);
  const notaryCommand = commandRecord('spctl', ['--assess', '--type', 'open', '--context', 'context:primary-signature', '-vv', artifactPath], spctl, artifactPath);
  const notaryOutput = notaryCommand.output.toLowerCase();
  if (spctl.status === 0 && /notarized/.test(notaryOutput)) {
    return { codeSigning: { status: 'signed', checked: true, reason: 'codesign verification passed', command: codeCommand }, notarization: { status: 'notarized', checked: true, reason: 'spctl accepted notarization', command: notaryCommand } };
  }
  if (/(not notarized|rejected)/.test(notaryOutput)) {
    return { codeSigning: { status: 'signed', checked: true, reason: 'codesign verification passed', command: codeCommand }, notarization: { status: 'unsigned', checked: true, reason: 'spctl did not prove notarization', command: notaryCommand } };
  }
  throw new Error('unrecognized macOS notarization output');
}

function checkWindowsAuthenticity(artifactPath, command) {
  if (!command.has('signtool')) return { codeSigning: unavailable('signtool is unavailable'), notarization: unavailable('Windows has no notarization check') };
  const result = command.run('signtool', ['verify', '/pa', artifactPath]);
  const record = commandRecord('signtool', ['verify', '/pa', artifactPath], result, artifactPath);
  const output = record.output.toLowerCase();
  if (result.status === 0 && /(successfully verified|success)/.test(output)) {
    return { codeSigning: { status: 'signed', checked: true, reason: 'Authenticode verification passed', command: record }, notarization: unavailable('Windows has no notarization check') };
  }
  if (/(no signature|not signed|unsigned)/.test(output)) {
    return { codeSigning: { status: 'unsigned', checked: true, reason: 'signtool reports no signature', command: record }, notarization: unavailable('Windows has no notarization check') };
  }
  throw new Error('unrecognized Windows Authenticode output');
}

export function collectAuthenticity({ artifacts, hostPlatform = process.platform, command = defaultCommand() }) {
  return PLATFORMS.map((platform) => {
    const artifact = artifacts.find((candidate) => candidate.platform === platform && candidate.kind !== 'release-asset');
    if (!artifact) return { platform, codeSigning: unavailable('no artifact for platform'), notarization: unavailable('no artifact for platform') };
    if (platform !== hostPlatform) return { platform, codeSigning: unavailable('foreign host'), notarization: unavailable('foreign host') };
    const artifactPath = artifact.absolutePath;
    if (platform === 'darwin') return { platform, ...checkMacAuthenticity(artifactPath, command) };
    if (platform === 'win32') return { platform, ...checkWindowsAuthenticity(artifactPath, command) };
    return { platform, codeSigning: unavailable('Linux signing is outside this collector'), notarization: unavailable('Linux has no notarization check') };
  });
}

function validRollback(rollback) {
  const value = asObject(rollback);
  return Boolean(
    value
    && value.immutable === true
    && ROLLBACK_ACTIONS.includes(value.decision)
    && Array.isArray(value.permittedActions)
    && value.permittedActions.length === ROLLBACK_ACTIONS.length
    && ROLLBACK_ACTIONS.every((action) => value.permittedActions.includes(action))
    && Array.isArray(value.prohibitedActions)
    && value.prohibitedActions.includes('overwrite-stable-tag')
    && value.prohibitedActions.includes('overwrite-stable-asset'),
  );
}

function defaultRollback(decision = 'withdraw-or-mark-non-latest') {
  if (!ROLLBACK_ACTIONS.includes(decision)) throw new Error('rollback decision must withdraw/non-latest or publish a new patch');
  return {
    immutable: true,
    decision,
    permittedActions: [...ROLLBACK_ACTIONS],
    prohibitedActions: ['overwrite-stable-tag', 'overwrite-stable-asset'],
    instructions: 'Withdraw or mark the release non-latest where allowed, or publish a new patch. Never overwrite an existing stable tag or asset.',
  };
}

function normalizePackageSmoke(packagedSmoke) {
  const value = asObject(packagedSmoke) ?? { status: 'not-run', evidencePath: null, artifactSha256: null };
  return { status: value.status, evidencePath: value.evidencePath ?? null, artifactSha256: value.artifactSha256 ?? null };
}

export function validateReleaseEvidence(value) {
  const errors = [];
  const evidence = asObject(value);
  if (!evidence) return { valid: false, errors: ['evidence must be an object'] };
  if (releaseEvidenceSchema.$id !== 'https://raw.githubusercontent.com/malyarq/burrow/main/quality/schemas/release-evidence.schema.json') errors.push('release evidence schema identity is invalid');
  if (evidence.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!['passed', 'failed'].includes(evidence.status)) errors.push('status must be passed or failed');
  try { validateCandidate(evidence.candidate); } catch (error) { errors.push(error.message); }
  if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length === 0) errors.push('artifacts must be a non-empty array');
  else {
    const paths = evidence.artifacts.map((artifact) => artifact?.path);
    if (paths.join('\n') !== [...paths].sort((left, right) => String(left).localeCompare(String(right), 'en')).join('\n')) errors.push('artifacts must be sorted by path');
    for (const artifact of evidence.artifacts) {
      if (!asObject(artifact) || typeof artifact.path !== 'string' || !ARTIFACT_PLATFORMS.includes(artifact.platform) || !['dmg', 'nsis', 'appimage', 'release-asset'].includes(artifact.kind) || !Number.isInteger(artifact.bytes) || artifact.bytes < 0 || typeof artifact.sha256 !== 'string' || !SHA256.test(artifact.sha256)) errors.push('artifact metadata is invalid');
    }
  }
  const integrity = asObject(evidence.integrity);
  if (!integrity || integrity.algorithm !== 'sha256' || !['passed', 'failed'].includes(integrity.status) || integrity.manifest !== 'SHA256SUMS.txt' || integrity.verification !== 'clean-verification-directory') errors.push('integrity evidence is invalid');
  if (!Array.isArray(evidence.authenticity) || evidence.authenticity.map((item) => item?.platform).join(',') !== PLATFORMS.join(',')) errors.push('authenticity must contain every platform in deterministic order');
  else for (const platform of evidence.authenticity) {
    for (const field of ['codeSigning', 'notarization']) if (!asObject(platform[field]) || !['signed', 'notarized', 'unsigned', 'unavailable'].includes(platform[field].status)) errors.push('authenticity status is invalid');
  }
  const smoke = asObject(evidence.packagedSmoke);
  if (!smoke || !['passed', 'failed', 'unsupported-runner', 'not-run'].includes(smoke.status) || !(typeof smoke.evidencePath === 'string' || smoke.evidencePath === null) || !(typeof smoke.artifactSha256 === 'string' || smoke.artifactSha256 === null)) errors.push('packaged smoke evidence is invalid');
  else if (smoke.status !== 'not-run' && (!smoke.evidencePath || !SHA256.test(smoke.artifactSha256 ?? ''))) errors.push('packaged smoke linkage is incomplete');
  else if (smoke.artifactSha256 && Array.isArray(evidence.artifacts) && !evidence.artifacts.some((artifact) => artifact.sha256 === smoke.artifactSha256)) errors.push('packaged smoke hash must match a release artifact');
  if (!validRollback(evidence.rollback)) errors.push('rollback policy must preserve immutable stable bytes');
  if (!Array.isArray(evidence.failures) || evidence.failures.some((failure) => typeof failure !== 'string' || failure.length === 0)) errors.push('failures must be a string array');
  if (evidence.status === 'passed' && evidence.failures?.length !== 0) errors.push('passed evidence cannot include failures');
  if (evidence.status === 'failed' && evidence.failures?.length === 0) errors.push('failed evidence must include failures');
  return { valid: errors.length === 0, errors };
}

export function collectReleaseEvidence(options = {}) {
  const fileSystem = { ...defaultFileSystem(), ...(options.fileSystem ?? {}) };
  const candidate = validateCandidate(options.candidate);
  const artifactsDir = resolve(options.artifactsDir ?? join(projectRoot, 'release', candidate.version));
  const artifacts = enumerateReleaseArtifacts({ artifactsDir, fileSystem }).map((artifact) => ({ ...artifact, absolutePath: join(artifactsDir, artifact.path) }));
  const rollback = options.rollback ?? defaultRollback(options.rollbackDecision);
  if (!validRollback(rollback)) throw new Error('rollback policy must preserve immutable stable bytes');
  const packagedSmoke = normalizePackageSmoke(options.packagedSmoke);
  const verificationDir = resolve(options.verificationRoot ?? fileSystem.mkdtemp(join(tmpdir(), 'burrow-release-evidence-')));
  writeSha256Sums({ artifactsDir, artifacts, fileSystem });
  const failures = [];
  let integrity = { algorithm: 'sha256', manifest: 'SHA256SUMS.txt', verification: 'clean-verification-directory', status: 'passed' };
  try {
    copyForVerification({ artifactsDir, verificationDir, artifacts, fileSystem });
    const verified = verifySha256Sums({ verificationDir, fileSystem });
    if (!verified.valid) throw new Error(verified.mismatches.join('; '));
  } catch (error) {
    integrity = { ...integrity, status: 'failed' };
    failures.push(error instanceof Error ? error.message : String(error));
  }
  let authenticity;
  try {
    authenticity = collectAuthenticity({ artifacts, hostPlatform: options.platform ?? process.platform, command: options.command ?? defaultCommand() });
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
    authenticity = PLATFORMS.map((platform) => ({ platform, codeSigning: unavailable('authenticity verification failed'), notarization: unavailable('authenticity verification failed') }));
  }
  const evidence = {
    schemaVersion: 1,
    status: failures.length === 0 ? 'passed' : 'failed',
    candidate,
    artifacts: artifacts.map((artifact) => ({
      path: artifact.path,
      platform: artifact.platform,
      kind: artifact.kind,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
    })),
    integrity,
    authenticity,
    packagedSmoke,
    rollback,
    failures,
  };
  const validation = validateReleaseEvidence(evidence);
  if (!validation.valid) throw new Error(`release evidence schema validation failed: ${validation.errors.join('; ')}`);
  return evidence;
}

function printHelp() {
  console.log('Usage: node scripts/release-evidence.js [--artifacts-dir <dir>] [--version <semver>] [--tag <tag>] [--commit <sha>] [--fixture-unsigned]');
}

function optionValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function fixtureUnsigned() {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'burrow-release-evidence-fixture-'));
  const verifyDir = mkdtempSync(join(tmpdir(), 'burrow-release-evidence-verify-'));
  try {
    writeFileSync(join(fixtureDir, 'Burrow-Linux-0.7.1.AppImage'), 'fixture-linux');
    const result = collectReleaseEvidence({
      artifactsDir: fixtureDir,
      verificationRoot: verifyDir,
      candidate: { version: '0.7.1', tag: 'v0.7.1', commit: 'a'.repeat(40) },
      platform: 'linux',
      command: { has: () => false, run: () => ({ status: 127, stdout: '', stderr: '' }) },
    });
    return result;
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
    rmSync(verifyDir, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return printHelp();
  let result;
  if (args.includes('--fixture-unsigned')) result = fixtureUnsigned();
  else {
    const version = optionValue(args, '--version');
    const tag = optionValue(args, '--tag');
    const commit = optionValue(args, '--commit');
    if (!version || !tag || !commit) throw new Error('--version, --tag, and --commit are required outside fixture mode');
    result = collectReleaseEvidence({ artifactsDir: optionValue(args, '--artifacts-dir'), candidate: { version, tag, commit } });
  }
  const output = optionValue(args, '--output');
  if (output) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Release evidence failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
