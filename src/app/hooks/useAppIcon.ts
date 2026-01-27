import { useEffect, useState } from 'react';
import { assetsIPC } from '../../services/ipc/assetsIPC';

export function useAppIcon() {
  // In dev mode, Vite dev server serves files from public, so use direct path
  // In production, we'll update this via IPC
  const [iconPath, setIconPath] = useState(() => (import.meta.env.DEV ? '/icon.png' : '/icon.png'));

  useEffect(() => {
    if (!import.meta.env.DEV && assetsIPC.has('getIconPath')) {
      assetsIPC
        .getIconPath()
        .then((path: string) => {
          setIconPath(path);
        })
        .catch(() => {
          setIconPath('/icon.png');
        });
    }
  }, []);

  return { iconPath };
}

