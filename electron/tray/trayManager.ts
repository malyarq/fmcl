import { Menu, Tray, nativeImage } from 'electron';

export type CreateTrayParams = {
  iconPath: string;
  onShowWindow: () => void;
  onQuit: () => void;
  onToggleWindowVisibility: () => void;
};

export function createTray(params: CreateTrayParams): Tray {
  const { iconPath, onShowWindow, onQuit, onToggleWindowVisibility } = params;

  const tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 }));
  const contextMenu = Menu.buildFromTemplate([
    { label: 'FriendLauncher', enabled: false },
    { type: 'separator' },
    { label: 'Show Window', click: () => onShowWindow() },
    { label: 'Quit', click: () => onQuit() },
  ]);

  tray.setToolTip('FriendLauncher');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    onToggleWindowVisibility();
  });

  return tray;
}

