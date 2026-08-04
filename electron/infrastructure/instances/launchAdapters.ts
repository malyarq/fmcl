import fs from 'node:fs';
import { resolveJavaPath } from '../../services/launcher/launchFlow/resolveJavaPath';
import { spawnMinecraft } from '../../services/launcher/launchFlow/spawnMinecraft';
import { getModpackDir } from '../../services/instances/paths';
import type { LauncherRoot } from '../../domains/instances/instanceTypes';

function rootPath(root: LauncherRoot): string {
  return root as unknown as string;
}

/**
 * Native launch capabilities are constructed at the infrastructure edge and
 * passed through the composition graph. They intentionally stay out of the
 * instance domain and shared IPC contracts.
 */
export function createLaunchAdapters() {
  return {
    rootPath,
    instancePath(root: LauncherRoot, instanceId: string): string {
      return getModpackDir(rootPath(root), instanceId);
    },
    ensureInstanceDirectory(instancePath: string): void {
      fs.mkdirSync(instancePath, { recursive: true });
      fs.mkdirSync(`${instancePath}/mods`, { recursive: true });
    },
    resolveJavaPath,
    spawnMinecraft,
    fetch: globalThis.fetch.bind(globalThis),
  } as const;
}

export type LaunchAdapters = ReturnType<typeof createLaunchAdapters>;
