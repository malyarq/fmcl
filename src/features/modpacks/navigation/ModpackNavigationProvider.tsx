import { useState, type ReactNode } from 'react';
import {
  type ModpackView,
  useModpackNavigation,
} from '../hooks/useModpackNavigation';
import { ModpackNavigationContext } from './ModpackNavigationContext';

export function ModpackNavigationProvider({
  children,
  initialView,
}: {
  children: ReactNode;
  initialView?: ModpackView;
}) {
  const [initial] = useState(() => initialView ?? { type: 'list' as const });
  const controller = useModpackNavigation(initial);

  return (
    <ModpackNavigationContext.Provider value={controller}>
      {children}
    </ModpackNavigationContext.Provider>
  );
}
