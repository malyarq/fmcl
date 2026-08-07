#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePackageSmokeEvidence } from './package-smoke.js';

const platforms = ['darwin', 'linux', 'win32'];
const sha256 = /^[a-f0-9]{64}$/;

function listSmokeFiles(root) {
  if (!existsSync(root)) throw new Error(`platform smoke input does not exist: ${root}`);
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile() && entry.name.endsWith('-package-smoke.json')) files.push(target);
    }
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

export function aggregatePlatformSmoke({ inputDir, requireUpgrade = false }) {
  const records = new Map();
  for (const evidencePath of listSmokeFiles(resolve(inputDir))) {
    let evidence;
    try {
      evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    } catch (error) {
      throw new Error(`invalid package smoke JSON at ${evidencePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const validation = validatePackageSmokeEvidence(evidence);
    if (!validation.valid) throw new Error(`invalid package smoke evidence at ${evidencePath}: ${validation.errors.join('; ')}`);
    if (records.has(evidence.platform)) throw new Error(`duplicate package smoke evidence for ${evidence.platform}`);
    if (!['passed', 'unsupported-runner'].includes(evidence.status)) throw new Error(`package smoke did not pass for ${evidence.platform}`);
    if (!sha256.test(evidence.artifact.sha256)) throw new Error(`package smoke artifact hash is invalid for ${evidence.platform}`);
    if (requireUpgrade && (!evidence.upgrade || evidence.upgrade.previousLaunchVerified !== true || evidence.upgrade.userDataPreserved !== true)) {
      throw new Error(`package upgrade smoke did not pass for ${evidence.platform}`);
    }
    const signing = evidence.signing.status === 'not-checked' ? 'unavailable' : evidence.signing.status;
    records.set(evidence.platform, {
      platform: evidence.platform,
      status: evidence.status,
      artifactSha256: evidence.artifact.sha256,
      evidencePath,
      signing,
      ...(evidence.status === 'unsupported-runner'
        ? { reason: evidence.error ?? 'host runner cannot execute this platform artifact' }
        : {}),
    });
  }
  const missing = platforms.filter((platform) => !records.has(platform));
  if (missing.length > 0) throw new Error(`platform smoke evidence is missing: ${missing.join(', ')}`);
  return platforms.map((platform) => records.get(platform));
}

export function writePlatformSmokeAggregate({ inputDir, outputFile, requireUpgrade = false }) {
  const value = aggregatePlatformSmoke({ inputDir, requireUpgrade });
  const output = resolve(outputFile);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function main() {
  const args = process.argv.slice(2);
  const inputDir = option(args, '--input');
  const outputFile = option(args, '--output');
  if (!inputDir || !outputFile) throw new Error('Usage: node scripts/aggregate-platform-smoke.js --input <directory> --output <file> [--require-upgrade]');
  writePlatformSmokeAggregate({ inputDir, outputFile, requireUpgrade: args.includes('--require-upgrade') });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
