#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');

function hasExplicitMacIdentity(args) {
  return args.some((argument) => argument === '-c.mac.identity'
    || argument === '--config.mac.identity'
    || argument.startsWith('-c.mac.identity=')
    || argument.startsWith('--config.mac.identity='));
}

export function hasDeveloperIdIdentity(run = spawnSync) {
  const result = run('security', ['find-identity', '-v', '-p', 'codesigning'], { encoding: 'utf8' });
  return result.status === 0 && /"Developer ID Application:[^"]+"/.test(result.stdout ?? '');
}

export function resolveBuilderArgs({ args, platform = process.platform, env = process.env, developerIdAvailable = hasDeveloperIdIdentity() }) {
  if (platform !== 'darwin' || hasExplicitMacIdentity(args) || env['CSC_LINK'] || env['CSC_NAME'] || developerIdAvailable) {
    return { args, signing: 'configured' };
  }

  const entitlements = 'resources/entitlements.adhoc.mac.plist';
  return {
    args: [...args, '-c.mac.identity=-', `-c.mac.entitlements=${entitlements}`, `-c.mac.entitlementsInherit=${entitlements}`],
    signing: 'ad-hoc',
  };
}

export function main(args = process.argv.slice(2)) {
  const resolved = resolveBuilderArgs({ args });
  if (resolved.signing === 'ad-hoc') {
    console.log('[build] Developer ID not found; using a local ad-hoc macOS signature. Public distribution still requires Developer ID and notarization.');
  }

  const cli = resolve(projectRoot, 'node_modules/electron-builder/cli.js');
  const result = spawnSync(process.execPath, [cli, ...resolved.args], { cwd: projectRoot, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
