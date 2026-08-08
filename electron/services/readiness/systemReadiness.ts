import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SystemReadinessCheck, SystemReadinessReport } from '../../../shared/contracts/systemReadiness';
import type { DetectedJava } from '../java/javaScanner';

const MIN_FREE_BYTES = 6 * 1024 * 1024 * 1024;
const NETWORK_PROBE_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

type SystemReadinessDependencies = Readonly<{
  rootPath: string;
  scanJava(): Promise<readonly DetectedJava[]>;
  verifyStorage?(rootPath: string): Promise<void>;
  getFreeBytes?(rootPath: string): Promise<number>;
  verifyNetwork?(): Promise<void>;
}>;

async function verifyStorage(rootPath: string): Promise<void> {
  await fs.mkdir(rootPath, { recursive: true });
  const probe = path.join(rootPath, `.burrow-readiness-${randomUUID()}`);
  try {
    await fs.writeFile(probe, 'ok', { flag: 'wx', mode: 0o600 });
  } finally {
    await fs.rm(probe, { force: true });
  }
}

async function getFreeBytes(rootPath: string): Promise<number> {
  const stats = await fs.statfs(rootPath, { bigint: true });
  const available = stats.bavail * stats.bsize;
  return available > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(available);
}

async function verifyNetwork(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(NETWORK_PROBE_URL, {
      headers: { range: 'bytes=0-0' },
      signal: controller.signal,
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`network probe failed with HTTP ${response.status}`);
  } finally {
    clearTimeout(timer);
  }
}

function overall(checks: readonly SystemReadinessCheck[]): SystemReadinessReport['overall'] {
  if (checks.some((check) => check.status === 'blocked')) return 'blocked';
  if (checks.some((check) => check.status === 'warning')) return 'attention';
  return 'ready';
}

export async function checkSystemReadiness(deps: SystemReadinessDependencies): Promise<SystemReadinessReport> {
  const storageCheck = (async (): Promise<SystemReadinessCheck> => {
    try {
      await (deps.verifyStorage ?? verifyStorage)(deps.rootPath);
      return { id: 'storage', status: 'ready', code: 'ready' };
    } catch {
      return { id: 'storage', status: 'blocked', code: 'unwritable' };
    }
  })();
  const diskCheck = (async (): Promise<SystemReadinessCheck> => {
    try {
      const freeBytes = await (deps.getFreeBytes ?? getFreeBytes)(deps.rootPath);
      return freeBytes >= MIN_FREE_BYTES
        ? { id: 'disk', status: 'ready', code: 'ready' }
        : { id: 'disk', status: 'warning', code: 'low-space' };
    } catch {
      return { id: 'disk', status: 'warning', code: 'low-space' };
    }
  })();
  const javaCheck = (async (): Promise<SystemReadinessCheck> => {
    try {
      const installations = await deps.scanJava();
      const supported = installations.some((installation) => installation.valid && [8, 17, 21, 25].includes(installation.majorVersion));
      return supported
        ? { id: 'java', status: 'ready', code: 'ready' }
        : { id: 'java', status: 'info', code: 'automatic-download' };
    } catch {
      return { id: 'java', status: 'info', code: 'automatic-download' };
    }
  })();
  const networkCheck = (async (): Promise<SystemReadinessCheck> => {
    try {
      await (deps.verifyNetwork ?? verifyNetwork)();
      return { id: 'network', status: 'ready', code: 'ready' };
    } catch {
      return { id: 'network', status: 'warning', code: 'unreachable' };
    }
  })();

  const checks = await Promise.all([storageCheck, diskCheck, javaCheck, networkCheck]);
  return { overall: overall(checks), checks };
}
