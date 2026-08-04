import { ipcRenderer } from 'electron'
import { ARCHIVE_INSPECTION_CHANNELS, type ArchiveInspectionAPI } from '@shared/contracts'

/** The renderer receives only the semantic archive selection capability. */
export const archiveInspection: ArchiveInspectionAPI = {
  select: () => ipcRenderer.invoke(ARCHIVE_INSPECTION_CHANNELS.select),
}
