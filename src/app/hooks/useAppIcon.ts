import { useEffect, useState } from 'react';
import { assetsIPC } from '../../services/ipc/assetsIPC';
import { getBrandAssetPath } from '../assets/branding';

const APP_ICON_PATH = getBrandAssetPath('app-icon');

export function useAppIcon() {
  const [iconPath, setIconPath] = useState(APP_ICON_PATH);

  useEffect(() => {
    if (!import.meta.env.DEV && assetsIPC.has('getIconPath')) {
      assetsIPC
        .getIconPath()
        .then((path: string) => {
          setIconPath(path);
        })
        .catch(() => {
          setIconPath(APP_ICON_PATH);
        });
    }
  }, []);

  return { iconPath };
}
