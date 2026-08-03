#!/usr/bin/env node

/**
 * Script for running full installation tests
 * Usage:
 *   node scripts/test-full.js [--stage=vanilla|forge|fabric|neoforge] [--provider=auto|mojang|bmclapi] [--limit=N] [--only=version1,version2]
 */

import { spawn } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] || '', 10);

if (nodeMajor !== 24) {
  console.error(`Full installation tests require Node.js 24.x (current: ${process.version}).`);
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  stage: null,
  provider: null,
  limit: null,
  only: null,
};

for (const arg of args) {
  if (arg.startsWith('--stage=')) {
    options.stage = arg.split('=')[1];
  } else if (arg.startsWith('--provider=')) {
    options.provider = arg.split('=')[1];
  } else if (arg.startsWith('--limit=')) {
    options.limit = arg.split('=')[1];
  } else if (arg.startsWith('--only=')) {
    options.only = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: node scripts/test-full.js [options]

Options:
  --stage=<stage>     Test stage: vanilla, forge, fabric, neoforge (default: all)
  --provider=<id>     Download provider: auto, mojang, bmclapi (default: auto)
  --limit=<N>         Limit number of versions to test (default: unlimited)
  --only=<versions>   Comma-separated list of specific versions to test
  --help, -h          Show this help message

Examples:
  node scripts/test-full.js
  node scripts/test-full.js --stage=vanilla
  node scripts/test-full.js --stage=forge --limit=5
  node scripts/test-full.js --only=1.20.1,1.19.2
    `);
    process.exit(0);
  }
}

const testUserDataPath = mkdtempSync(join(tmpdir(), 'fmcl-full-install-'));
const testConfigPath = join(testUserDataPath, 'full-test-config.json');
const testConfig = {
  enabled: true,
  stage: options.stage || null,
  provider: options.provider || null,
  limit: options.limit || null,
  only: options.only || null,
};

writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2), 'utf-8');

// Cleanup function
const cleanup = () => {
  try {
    unlinkSync(testConfigPath);
  } catch {
    // Ignore errors during cleanup
  }

  try {
    rmSync(testUserDataPath, { recursive: true, force: true });
  } catch {
    // Ignore errors during cleanup
  }
};

// Build once before launching Electron. Starting through the Vite dev watcher can
// briefly execute a stale dist-electron/main.js and turn the smoke test into a
// normal interactive launcher session.
const vitePath = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCliPath = join(projectRoot, 'node_modules', 'electron', 'cli.js');
let electronProcess = null;

const buildProcess = spawn(process.execPath, [vitePath, 'build'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  shell: false,
});

buildProcess.on('error', (error) => {
  console.error('Failed to build the full installation harness:', error);
  cleanup();
  process.exit(1);
});

buildProcess.on('exit', (buildCode) => {
  if (buildCode !== 0) {
    cleanup();
    process.exit(buildCode ?? 1);
    return;
  }

  electronProcess = spawn(process.execPath, [electronCliPath, '.'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FMCL_TEST_USER_DATA: testUserDataPath,
      FMCL_FULL_TEST_CONFIG: testConfigPath,
    },
    stdio: 'inherit',
    shell: false,
  });

  electronProcess.on('error', (error) => {
    console.error('Failed to start Electron:', error);
    cleanup();
    process.exit(1);
  });

  electronProcess.on('exit', (code) => {
    cleanup();
    process.exit(code ?? 1);
  });
});

const stopChild = (signal) => {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill(signal);
    return;
  }

  if (!buildProcess.killed) {
    buildProcess.kill(signal);
  }
};

// Handle process termination. Cleanup happens after the child exits, which
// prevents Electron helpers from recreating files inside a just-removed folder.
process.on('SIGINT', () => {
  stopChild('SIGINT');
});

process.on('SIGTERM', () => {
  stopChild('SIGTERM');
});
