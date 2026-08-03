#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawArgs = process.argv.slice(2);
const push = rawArgs.includes('--push');
const dryRun = rawArgs.includes('--dry-run');
const positional = rawArgs.filter((argument) => !argument.startsWith('--'));
const version = positional[0];
const commitMessage = positional.slice(1).join(' ') || (version ? `Release v${version}` : '');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  });
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

if (!version) {
  fail('version is required. Usage: npm run release -- 1.2.3 [message] [--dry-run] [--push]');
}

if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail('version must be valid SemVer without a leading v');
}

try {
  const status = run('git', ['status', '--porcelain'], { capture: true }).trim();
  if (status) {
    fail('the worktree must be clean before preparing a release');
  }

  const branch = run('git', ['branch', '--show-current'], { capture: true }).trim();
  if (!branch) {
    fail('releases cannot be prepared from a detached HEAD');
  }

  const tagName = `v${version}`;
  try {
    run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`], { capture: true });
    fail(`tag ${tagName} already exists`);
  } catch (error) {
    if (error?.status === 1) {
      // Expected: the tag does not exist yet.
    } else {
      throw error;
    }
  }

  console.log(`Verifying ${tagName} from branch ${branch}...`);
  run('npm', ['run', 'verify']);
  run('npm', ['run', 'build', '--', '--publish', 'never']);

  if (dryRun) {
    console.log(`Release preflight passed for ${tagName}; no files, commits, tags, or remotes were changed.`);
    process.exit(0);
  }

  run('npm', ['version', version, '--no-git-tag-version', '--allow-same-version']);

  const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(readFileSync(join(rootDir, 'package-lock.json'), 'utf8'));
  if (packageJson.version !== version || packageLock.version !== version) {
    fail('package.json and package-lock.json did not receive the requested version');
  }

  run('git', ['add', '--', 'package.json', 'package-lock.json']);
  run('git', ['commit', '-m', commitMessage]);
  run('git', ['tag', '-a', tagName, '-m', `Release ${tagName}`]);

  if (push) {
    run('git', ['push', 'origin', branch]);
    run('git', ['push', 'origin', tagName]);
    console.log(`Release ${tagName} was pushed; GitHub Actions can now publish the artifacts.`);
  } else {
    console.log(`Release ${tagName} is prepared locally. Review it, then push the branch and tag explicitly.`);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}
