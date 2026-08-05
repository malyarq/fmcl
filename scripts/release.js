#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPackageSmoke, validatePackageSmokeEvidence } from './package-smoke.js';
import { writePlatformSmokeAggregate } from './aggregate-platform-smoke.js';
import { validatePrepushReleaseReport } from './prepush-release-report.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const LOCAL_APPROVAL = 'approve-local-release';

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

export function parseReleaseArgs(rawArgs) {
  const dryRun = rawArgs.includes('--dry-run');
  const push = rawArgs.includes('--push');
  const optionNames = new Set(['--report', '--approval', '--platform-smoke', '--release-dir']);
  const positional = rawArgs.filter((argument, index) => !argument.startsWith('--') && !optionNames.has(rawArgs[index - 1]));
  const version = positional[0];
  return {
    version,
    dryRun,
    push,
    reportPath: optionValue(rawArgs, '--report'),
    approval: optionValue(rawArgs, '--approval'),
    platformSmokePath: optionValue(rawArgs, '--platform-smoke'),
    releaseDir: optionValue(rawArgs, '--release-dir'),
  };
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function fail(message) {
  throw new Error(message);
}

function readJson(filePath, label) {
  if (!filePath || !existsSync(filePath)) fail(`${label} does not exist: ${filePath ?? '(missing path)'}`);
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readCandidate(version) {
  if (!version || !semver.test(version)) fail('version must be valid SemVer without a leading v');
  const packageVersion = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')).version;
  if (packageVersion !== version) fail(`package.json version ${packageVersion} does not match requested candidate ${version}; create and commit the version-first candidate before release preparation`);
  const status = run('git', ['status', '--porcelain'], { capture: true }).trim();
  if (status) fail('the worktree must be clean before preparing a release candidate');
  const branch = run('git', ['branch', '--show-current'], { capture: true }).trim();
  if (!branch) fail('releases cannot be prepared from a detached HEAD');
  const tag = `v${version}`;
  const commit = run('git', ['rev-parse', 'HEAD'], { capture: true }).trim();
  try {
    run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`], { capture: true });
    fail(`tag ${tag} already exists`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`tag ${tag} already exists`)) throw error;
    if (error?.status !== 1) throw error;
  }
  return { version, tag, commit, branch };
}

export function validateApprovedReport({ report, candidate, approval }) {
  if (approval !== LOCAL_APPROVAL) fail(`local mutation mode requires --approval ${LOCAL_APPROVAL}; this is not publication authorization`);
  const validation = validatePrepushReleaseReport(report);
  if (!validation.valid) fail(`pre-push report is invalid: ${validation.errors.join('; ')}`);
  if (report.candidate.version !== candidate.version || report.candidate.tag !== candidate.tag || report.candidate.commit !== candidate.commit) {
    fail('pre-push report is stale or does not exactly match the current version/tag/commit candidate');
  }
  return report;
}

export async function collectPlatformSmoke({ releaseDir, version, evidenceDir, runSmoke = runPackageSmoke, writeAggregate = writePlatformSmokeAggregate }) {
  for (const platform of ['darwin', 'linux', 'win32']) {
    const evidence = await runSmoke({ platform, releaseDir, version });
    const validation = validatePackageSmokeEvidence(evidence);
    if (!validation.valid) fail(`package smoke evidence is invalid for ${platform}: ${validation.errors.join('; ')}`);
    const outputPath = join(evidenceDir, `${platform}-package-smoke.json`);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
  }
  const outputPath = join(evidenceDir, 'platform-smoke.json');
  writeAggregate({ inputDir: evidenceDir, outputFile: outputPath });
  return outputPath;
}

async function prepareDryRunReport(candidate, options) {
  const releaseDir = resolve(rootDir, options.releaseDir ?? join('release', candidate.version));
  const evidenceDir = join(rootDir, 'quality/evidence');
  const qualityPath = join(evidenceDir, 'quality-contract.json');
  const releaseEvidencePath = join(evidenceDir, 'release-evidence.json');
  const reportPath = resolve(rootDir, options.reportPath ?? join('quality/evidence', 'prepush-release-report.json'));

  console.log(`Running the shared release quality profile for ${candidate.tag}...`);
  run('npm', ['run', 'quality:check', '--', '--profile=release', '--releaseDir', releaseDir, '--version', candidate.version, '--tag', candidate.tag, '--commit', candidate.commit, '--report', releaseEvidencePath]);
  readJson(qualityPath, 'release quality evidence');
  readJson(releaseEvidencePath, 'release evidence');
  const platformSmokePath = options.platformSmokePath
    ? resolve(rootDir, options.platformSmokePath)
    : await collectPlatformSmoke({ releaseDir, version: candidate.version, evidenceDir });
  readJson(platformSmokePath, 'three-platform smoke aggregate');
  run(process.execPath, [
    join(rootDir, 'scripts/prepush-release-report.js'),
    '--version', candidate.version,
    '--tag', candidate.tag,
    '--commit', candidate.commit,
    '--quality', qualityPath,
    '--release-evidence', releaseEvidencePath,
    '--platform-smoke', platformSmokePath,
    '--output', reportPath,
  ]);
  const report = readJson(reportPath, 'generated pre-push report');
  const validation = validatePrepushReleaseReport(report);
  if (!validation.valid) fail(`generated pre-push report is invalid: ${validation.errors.join('; ')}`);
  if (report.candidate.version !== candidate.version || report.candidate.tag !== candidate.tag || report.candidate.commit !== candidate.commit) {
    fail('generated pre-push report does not match the local candidate');
  }
  return reportPath;
}

function prepareMutation(candidate, options) {
  if (!options.reportPath) fail('non-dry-run preparation requires --report <schema-valid-prepush-report.json>');
  const report = readJson(resolve(rootDir, options.reportPath), 'pre-push report');
  validateApprovedReport({ report, candidate, approval: options.approval });
  console.log(`Local approval accepted for ${candidate.tag}; it cannot authorize publication. The dispatch-only workflow must independently validate evidence and await release-publication Environment approval.`);
  run('git', ['tag', '-a', candidate.tag, '-m', `Release ${candidate.tag}`]);
  if (options.push) {
    run('git', ['push', 'origin', candidate.branch]);
    run('git', ['push', 'origin', candidate.tag]);
  }
}

export async function main(rawArgs = process.argv.slice(2)) {
  const options = parseReleaseArgs(rawArgs);
  if (!options.version) fail('version is required. Usage: npm run release -- 1.2.3 --dry-run [--platform-smoke path]');
  const candidate = readCandidate(options.version);
  if (options.dryRun) {
    const reportPath = await prepareDryRunReport(candidate, options);
    console.log(`Release dry run passed for ${candidate.tag}; report: ${reportPath}`);
    console.log('No commit, tag, push, remote, or GitHub release was created. Local evidence is not a publication authorization boundary.');
    return;
  }
  prepareMutation(candidate, options);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
