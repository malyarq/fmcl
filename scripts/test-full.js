#!/usr/bin/env node

/**
 * Script for running full installation tests
 * Usage:
 *   node scripts/test-full.js [--stage=vanilla|forge|fabric|neoforge] [--provider=auto|mojang|bmclapi] [--limit=N] [--only=version1,version2]
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

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

// Create test config file
const testConfigPath = join(projectRoot, '.test-config.json');
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
};

// Find vite executable
const vitePath = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

// Spawn vite process
const viteProcess = spawn('node', [vitePath], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: 'test',
  },
  stdio: 'inherit',
  shell: false,
});

viteProcess.on('error', (error) => {
  console.error('Failed to start vite:', error);
  cleanup();
  process.exit(1);
});

viteProcess.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 1);
});

// Handle process termination
process.on('SIGINT', () => {
  cleanup();
  viteProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  cleanup();
  viteProcess.kill('SIGTERM');
});
