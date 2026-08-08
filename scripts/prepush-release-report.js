#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const schema = JSON.parse(readFileSync(join(projectRoot, 'quality/schemas/prepush-release-report.schema.json'), 'utf8'));
const platforms = ['darwin', 'linux', 'win32'];
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const commit = /^[a-f0-9]{40}$/;
const sha256 = /^[a-f0-9]{64}$/;

function asObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function validateCandidate(value) {
  const candidate = asObject(value);
  if (!candidate || typeof candidate.version !== 'string' || !semver.test(candidate.version)) throw new Error('candidate version must be SemVer');
  if (candidate.tag !== `v${candidate.version}`) throw new Error('candidate tag must exactly match version');
  if (typeof candidate.commit !== 'string' || !commit.test(candidate.commit)) throw new Error('candidate commit must be a 40-character SHA');
  return { version: candidate.version, tag: candidate.tag, commit: candidate.commit };
}

function sameCandidate(left, right) {
  return left.version === right.version && left.tag === right.tag && left.commit === right.commit;
}

function reportIdentity(candidate, artifacts) {
  return `prepush-${createHash('sha256').update(JSON.stringify({ candidate, artifacts })).digest('hex')}`;
}

function validRollback(rollback) {
  const value = asObject(rollback);
  return Boolean(value && value.immutable === true && ['withdraw-or-mark-non-latest', 'publish-new-patch'].includes(value.decision)
    && Array.isArray(value.permittedActions) && value.permittedActions.length === 2
    && value.permittedActions.includes('withdraw-or-mark-non-latest') && value.permittedActions.includes('publish-new-patch')
    && Array.isArray(value.prohibitedActions) && value.prohibitedActions.includes('overwrite-stable-tag') && value.prohibitedActions.includes('overwrite-stable-asset')
    && typeof value.instructions === 'string' && value.instructions.includes('Never overwrite an existing stable tag or asset'));
}

function normalizeArtifacts(evidence) {
  if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length === 0) throw new Error('release evidence must include artifacts');
  const artifacts = evidence.artifacts.map((artifact) => ({ path: artifact?.path, platform: artifact?.platform, sha256: artifact?.sha256 }));
  if (artifacts.some((artifact) => typeof artifact.path !== 'string' || !['darwin', 'linux', 'win32', 'shared'].includes(artifact.platform) || typeof artifact.sha256 !== 'string' || !sha256.test(artifact.sha256))) throw new Error('release artifact evidence is incomplete');
  return artifacts.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

function normalizePlatformSmoke(value, artifacts) {
  if (!Array.isArray(value) || value.length !== platforms.length) throw new Error('platform smoke must cover every platform');
  const smoke = value.map((entry) => ({ platform: entry?.platform, status: entry?.status, artifactSha256: entry?.artifactSha256, evidencePath: entry?.evidencePath, signing: entry?.signing, ...(entry?.reason ? { reason: entry.reason } : {}) }));
  if (smoke.map((entry) => entry.platform).join(',') !== platforms.join(',')) throw new Error('platform smoke must use deterministic platform order');
  for (const entry of smoke) {
    if (!['passed', 'unsupported-runner'].includes(entry.status) || typeof entry.evidencePath !== 'string' || entry.evidencePath.length === 0 || typeof entry.artifactSha256 !== 'string' || !sha256.test(entry.artifactSha256) || !['signed', 'unsigned', 'unavailable'].includes(entry.signing)) throw new Error(`platform smoke is incomplete for ${entry.platform}`);
    if (!artifacts.some((artifact) => artifact.platform === entry.platform && artifact.sha256 === entry.artifactSha256)) throw new Error(`platform smoke hash is not bound to a ${entry.platform} artifact`);
    if (entry.status === 'unsupported-runner' && (!entry.reason || typeof entry.reason !== 'string')) throw new Error(`unsupported runner disclosure is required for ${entry.platform}`);
  }
  return smoke;
}

export function validatePrepushReleaseReport(value) {
  const errors = [];
  const report = asObject(value);
  if (!report) return { valid: false, errors: ['report must be an object'] };
  if (schema.$id !== 'https://raw.githubusercontent.com/malyarq/burrow/main/quality/schemas/prepush-release-report.schema.json') errors.push('schema identity is invalid');
  if (report.schemaVersion !== 1 || report.status !== 'passed') errors.push('report status is invalid');
  let candidate;
  try { candidate = validateCandidate(report.candidate); } catch (error) { errors.push(error.message); }
  if (typeof report.reportId !== 'string' || !/^prepush-[a-f0-9]{64}$/.test(report.reportId)) errors.push('report identity is invalid');
  const quality = asObject(report.quality);
  if (!quality || quality.profile !== 'release' || quality.status !== 'passed') errors.push('release quality evidence is invalid');
  const artifacts = Array.isArray(report.artifacts) ? report.artifacts : [];
  if (artifacts.length < 3 || artifacts.some((artifact) => !asObject(artifact) || typeof artifact.path !== 'string' || !sha256.test(artifact.sha256 ?? ''))) errors.push('artifact evidence is invalid');
  try { normalizePlatformSmoke(report.platformSmoke, artifacts); } catch (error) { errors.push(error.message); }
  if (!Array.isArray(report.authenticity) || report.authenticity.map((entry) => entry?.platform).join(',') !== platforms.join(',')) errors.push('authenticity evidence is incomplete');
  if (!Array.isArray(report.knownFailures) || report.knownFailures.some((failure) => typeof failure !== 'string')) errors.push('known failures are invalid');
  if (!validRollback(report.rollback)) errors.push('rollback proposal is invalid');
  if (candidate && report.reportId !== reportIdentity(candidate, artifacts)) errors.push('report identity does not bind candidate and artifacts');
  return { valid: errors.length === 0, errors };
}

export function createPrepushReleaseReport(options) {
  const candidate = validateCandidate(options?.candidate);
  if (options.packageVersion !== candidate.version) throw new Error('package version does not match candidate tag');
  if (options.cleanWorktree !== true) throw new Error('pre-push report requires a clean worktree');
  const quality = asObject(options.qualityResult);
  if (!quality || quality.profile !== 'release' || quality.status !== 'passed') throw new Error('release quality contract did not pass');
  const releaseEvidence = asObject(options.releaseEvidence);
  if (!releaseEvidence || releaseEvidence.status !== 'passed') throw new Error('release evidence did not pass');
  const evidenceCandidate = validateCandidate(releaseEvidence.candidate);
  if (!sameCandidate(candidate, evidenceCandidate)) throw new Error('release evidence candidate does not match dispatched candidate');
  const artifacts = normalizeArtifacts(releaseEvidence);
  const platformSmoke = normalizePlatformSmoke(options.platformSmoke, artifacts);
  if (!Array.isArray(releaseEvidence.authenticity) || releaseEvidence.authenticity.map((entry) => entry?.platform).join(',') !== platforms.join(',')) throw new Error('release evidence must disclose authenticity for every platform');
  if (!validRollback(releaseEvidence.rollback)) throw new Error('rollback must not overwrite immutable release bytes');
  const knownFailures = Array.isArray(releaseEvidence.failures) ? releaseEvidence.failures : null;
  if (!knownFailures || knownFailures.length !== 0) throw new Error('passing release evidence must not hide failures');
  const value = { schemaVersion: 1, reportId: reportIdentity(candidate, artifacts), status: 'passed', candidate, quality: { profile: quality.profile, status: quality.status }, artifacts, platformSmoke, authenticity: releaseEvidence.authenticity, knownFailures, rollback: releaseEvidence.rollback };
  const validation = validatePrepushReleaseReport(value);
  if (!validation.valid) throw new Error(`pre-push report schema validation failed: ${validation.errors.join('; ')}`);
  return value;
}

export function writePrepushReleaseReport({ outputFile, ...options }) {
  if (typeof outputFile !== 'string' || outputFile.length === 0) throw new Error('outputFile is required');
  const report = createPrepushReleaseReport(options);
  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function assertNoMutationCommands(source) {
  const prohibited = [/\bgit\s+(?:commit|tag|push)\b/i, /\bgh\s+(?:release|api|workflow)\b/i, /workflow[_ -]?dispatch/i, new RegExp(['upload', 'artifact'].join('-'), 'i')];
  if (prohibited.some((pattern) => pattern.test(source))) throw new Error('forbidden mutation command in pre-push report generator');
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readCleanWorktree() {
  return execFileSync('git', ['status', '--porcelain'], { cwd: projectRoot, encoding: 'utf8' }).trim().length === 0;
}

function option(args, name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}

function fixture() {
  const candidate = { version: '0.8.0-rc.1', tag: 'v0.8.0-rc.1', commit: 'a'.repeat(40) };
  const artifact = (platform, suffix, char) => ({ path: `Burrow-${suffix}`, platform, kind: 'release-asset', bytes: 1, sha256: char.repeat(64) });
  const artifacts = [artifact('darwin', 'Mac-0.8.0-rc.1-Installer.dmg', 'a'), artifact('linux', 'Linux-0.8.0-rc.1.AppImage', 'b'), artifact('win32', 'Windows-0.8.0-rc.1-Setup.exe', 'c')];
  return createPrepushReleaseReport({ candidate, packageVersion: candidate.version, cleanWorktree: true, qualityResult: { profile: 'release', status: 'passed' }, releaseEvidence: { status: 'passed', candidate, artifacts, authenticity: platforms.map((platform) => ({ platform })), rollback: { immutable: true, decision: 'withdraw-or-mark-non-latest', permittedActions: ['withdraw-or-mark-non-latest', 'publish-new-patch'], prohibitedActions: ['overwrite-stable-tag', 'overwrite-stable-asset'], instructions: 'Never overwrite an existing stable tag or asset' }, failures: [] }, platformSmoke: artifacts.map((artifact) => ({ platform: artifact.platform, status: 'passed', artifactSha256: artifact.sha256, evidencePath: `smoke/${artifact.platform}.json`, signing: 'unsigned' })) });
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--fixture')) return console.log(JSON.stringify(fixture(), null, 2));
  const version = args.find((arg) => semver.test(arg)) ?? option(args, 'version');
  const tag = option(args, 'tag') ?? (version ? `v${version}` : undefined);
  const commitValue = option(args, 'commit');
  const qualityPath = option(args, 'quality');
  const releaseEvidencePath = option(args, 'release-evidence');
  const smokePath = option(args, 'platform-smoke');
  const outputFile = option(args, 'output') ?? join(projectRoot, 'quality/evidence/prepush-release-report.json');
  if (!version || !tag || !commitValue || !qualityPath || !releaseEvidencePath || !smokePath) throw new Error('version/tag/commit, quality, release-evidence and platform-smoke inputs are required');
  const packageVersion = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).version;
  writePrepushReleaseReport({ candidate: { version, tag, commit: commitValue }, packageVersion, cleanWorktree: readCleanWorktree(), qualityResult: readJson(qualityPath), releaseEvidence: readJson(releaseEvidencePath), platformSmoke: readJson(smokePath), outputFile });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
