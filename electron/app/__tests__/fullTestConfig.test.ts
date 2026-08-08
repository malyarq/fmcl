import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadFullTestConfig } from '../fullTestConfig';

const tempDirs: string[] = [];

function writeConfig(value: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-test-config-'));
  tempDirs.push(dir);
  const configPath = path.join(dir, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(value), 'utf8');
  return configPath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadFullTestConfig', () => {
  it('does nothing unless the harness explicitly provides a config path', () => {
    expect(loadFullTestConfig({ NODE_ENV: 'test' })).toBeNull();
  });

  it('loads a validated absolute config only in test mode', () => {
    const configPath = writeConfig({
      enabled: true,
      stage: 'vanilla',
      provider: null,
      limit: '1',
      only: '1.20.1',
      launchSmoke: true,
    });

    expect(loadFullTestConfig({
      NODE_ENV: 'test',
      BURROW_FULL_TEST_CONFIG: configPath,
    })).toEqual({
      enabled: true,
      stage: 'vanilla',
      provider: null,
      limit: '1',
      only: '1.20.1',
      launchSmoke: true,
    });
  });

  it('rejects production use and malformed payloads', () => {
    const configPath = writeConfig({ enabled: false });

    expect(() => loadFullTestConfig({
      NODE_ENV: 'production',
      BURROW_FULL_TEST_CONFIG: configPath,
    })).toThrow(/NODE_ENV=test/);
    expect(() => loadFullTestConfig({
      NODE_ENV: 'test',
      BURROW_FULL_TEST_CONFIG: configPath,
    })).toThrow(/invalid/);

    const invalidLaunch = writeConfig({ enabled: true, launchSmoke: 'yes' });
    expect(() => loadFullTestConfig({
      NODE_ENV: 'test',
      BURROW_FULL_TEST_CONFIG: invalidLaunch,
    })).toThrow(/invalid/);
  });
});
