import { createContext, useContext, type MouseEvent } from 'react';

export interface InstalledModpackMenuTrigger {
  activeModpackId: string | null;
  openAtPointer: (event: MouseEvent, modpackId: string) => void;
  openFromButton: (event: MouseEvent<HTMLButtonElement>, modpackId: string) => void;
  openFromKeyboard: (anchor: HTMLElement, modpackId: string) => void;
}

export const InstalledModpackMenuContext = createContext<InstalledModpackMenuTrigger | null>(null);

export function useInstalledModpackContextMenu(): InstalledModpackMenuTrigger {
  const value = useContext(InstalledModpackMenuContext);
  if (!value) throw new Error('InstalledModpackCatalog must be inside InstalledModpackContextMenu');
  return value;
}
