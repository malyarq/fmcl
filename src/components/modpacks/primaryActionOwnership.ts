import { useSyncExternalStore } from 'react';
import type { ModpackView } from '../../features/modpacks/hooks/useModpackNavigation';

export type ModpackPrimaryActionOwnership = 'shell' | 'route';

const ROUTE_OWNED_VIEW_TYPES: ReadonlySet<ModpackView['type']> = new Set([
  'details',
  'create',
  'addMod',
  'addResourcePack',
  'addShader',
  'export',
  'install',
  'importPreview',
]);

let currentPrimaryActionOwnership: ModpackPrimaryActionOwnership = 'shell';
const primaryActionOwnershipListeners = new Set<() => void>();

function emitPrimaryActionOwnershipChange() {
  primaryActionOwnershipListeners.forEach((listener) => listener());
}

export function setModpackPrimaryActionOwnership(nextOwnership: ModpackPrimaryActionOwnership) {
  if (currentPrimaryActionOwnership === nextOwnership) {
    return;
  }

  currentPrimaryActionOwnership = nextOwnership;
  emitPrimaryActionOwnershipChange();
}

export function getPrimaryActionOwnershipForView(view: ModpackView): ModpackPrimaryActionOwnership {
  return ROUTE_OWNED_VIEW_TYPES.has(view.type) ? 'route' : 'shell';
}

export function useModpackPrimaryActionOwnership() {
  return useSyncExternalStore(
    (listener) => {
      primaryActionOwnershipListeners.add(listener);

      return () => {
        primaryActionOwnershipListeners.delete(listener);
      };
    },
    () => currentPrimaryActionOwnership,
    () => currentPrimaryActionOwnership,
  );
}
