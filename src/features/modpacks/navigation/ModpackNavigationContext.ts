import { createContext, useContext } from 'react';
import type { useModpackNavigation } from '../hooks/useModpackNavigation';

export type ModpackNavigationController = ReturnType<typeof useModpackNavigation>;

export const ModpackNavigationContext = createContext<ModpackNavigationController | null>(null);

export function useOptionalModpackNavigation(): ModpackNavigationController | null {
  return useContext(ModpackNavigationContext);
}

export function usePersistentModpackNavigation(): ModpackNavigationController {
  const controller = useOptionalModpackNavigation();
  if (!controller) {
    throw new Error('Modpack navigation requires ModpackNavigationProvider');
  }
  return controller;
}
