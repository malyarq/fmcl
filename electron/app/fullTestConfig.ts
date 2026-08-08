import fs from 'node:fs';
import path from 'node:path';
import type { TestConfig } from './fullInstallationTest';

export type EnabledFullTestConfig = TestConfig & { enabled: true };

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

export function loadFullTestConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EnabledFullTestConfig | null {
  const configPath = env['BURROW_FULL_TEST_CONFIG'];
  if (!configPath) {
    return null;
  }

  if (env['NODE_ENV'] !== 'test' || !path.isAbsolute(configPath)) {
    throw new Error('BURROW_FULL_TEST_CONFIG requires NODE_ENV=test and an absolute path');
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Full installation test config must be an object');
  }

  const config = parsed as Record<string, unknown>;
  if (
    config.enabled !== true
    || !isOptionalString(config.stage)
    || !isOptionalString(config.provider)
    || !isOptionalString(config.limit)
    || !isOptionalString(config.only)
    || (config.launchSmoke !== undefined && typeof config.launchSmoke !== 'boolean')
  ) {
    throw new Error('Full installation test config is invalid');
  }

  return {
    enabled: true,
    stage: config.stage,
    provider: config.provider,
    limit: config.limit,
    only: config.only,
    ...(config.launchSmoke === undefined ? {} : { launchSmoke: config.launchSmoke }),
  };
}
