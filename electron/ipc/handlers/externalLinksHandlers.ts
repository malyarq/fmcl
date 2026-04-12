import { BrowserWindow, ipcMain } from 'electron'
import type { ExternalLinkRequest } from '@shared/contracts/externalLinks'
import { openExternalUrl } from '../../security/externalUrls'
import { validateBoundedString, validateOptionalBoundedString } from '../validation/privilegedPayloads'

function validateExternalLinkRequest(value: unknown): ExternalLinkRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('External link request must be an object.')
  }

  const record = value as Record<string, unknown>

  return {
    url: validateBoundedString(record.url, 'External link URL', { maxLength: 2048 }),
    context: validateOptionalBoundedString(record.context, 'External link context', { maxLength: 160 }),
  }
}

export function registerExternalLinksHandlers(): void {
  ipcMain.handle('externalLinks:open', async (event, request: unknown) => {
    const safeRequest = validateExternalLinkRequest(request)
    return await openExternalUrl(safeRequest, {
      parentWindow: BrowserWindow.fromWebContents(event.sender) ?? undefined,
      showBlockedDialog: true,
    })
  })
}
