import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { ARCHIVE_INSPECTION_CHANNELS, type ArchiveManifestMetadata } from '../../../shared/contracts/archiveInspection';
import { authorizeArchiveReference } from '../../security/archiveReferenceAuthorizations';

type ArchiveInspectionDependencies = Readonly<{
  window: BrowserWindow;
  inspectArchive(filePath: string): Promise<ArchiveManifestMetadata>;
}>;

/** Registers the narrow, path-free archive selection and preview capability. */
export function registerArchiveInspectionHandlers(deps: ArchiveInspectionDependencies): void {
  ipcMain.removeHandler(ARCHIVE_INSPECTION_CHANNELS.select);
  ipcMain.handle(ARCHIVE_INSPECTION_CHANNELS.select, async (event) => {
    const selection = await dialog.showOpenDialog(deps.window, {
      title: 'Select Modpack Archive',
      properties: ['openFile'],
      filters: [{ name: 'Modpack archives', extensions: ['zip', 'mrpack'] }],
    });
    const filePath = selection.filePaths[0];
    if (selection.canceled || !filePath) return { status: 'cancelled' } as const;

    const archiveRef = authorizeArchiveReference(event.sender.id, filePath);
    const inspection = await deps.inspectArchive(filePath);
    return { status: 'selected', archiveRef, ...inspection } as const;
  });
}
