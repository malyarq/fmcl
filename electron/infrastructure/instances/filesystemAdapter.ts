import { resolveApprovedLauncherRootPath } from '../../services/instances/paths';
import type { LauncherRoot } from '../../domains/instances/instanceTypes';
import type { LauncherRootResolver } from '../../domains/instances/ports';

/**
 * The only composition-facing filesystem authority for canonical instance
 * roots. Domain code receives an opaque LauncherRoot, never a native path.
 */
export function createFilesystemInstanceAdapter(): Readonly<{
  rootResolver: LauncherRootResolver;
}> {
  return {
    rootResolver: {
      async resolve(input: unknown): Promise<LauncherRoot> {
        if (typeof input !== 'string') throw new Error('Launcher root input must be a string');
        return resolveApprovedLauncherRootPath(input) as unknown as LauncherRoot;
      },
    },
  };
}
