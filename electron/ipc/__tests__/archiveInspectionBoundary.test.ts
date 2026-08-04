import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('archive inspection IPC boundary wiring', () => {
  it('registers the dedicated handler with main-owned archive inspection only', async () => {
    const source = await readFile(new URL('../ipcManager.ts', import.meta.url), 'utf8');

    expect(source).toContain("import { registerArchiveInspectionHandlers } from './handlers/archiveInspectionHandlers'");
    expect(source).toContain('registerArchiveInspectionHandlers({ window, inspectArchive })');
  });

  it('exposes only the typed archiveInspection preload namespace', async () => {
    const [bridge, preload, windowApi] = await Promise.all([
      readFile(new URL('../../preload/bridges/ArchiveInspectionBridge.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../preload.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../../shared/contracts/windowApi.ts', import.meta.url), 'utf8'),
    ]);

    expect(bridge).toContain('ArchiveInspectionAPI');
    expect(bridge).toContain('ARCHIVE_INSPECTION_CHANNELS');
    expect(bridge).not.toMatch(/dialogs|filePath|path|archiveReferenceAuthorizations/);
    expect(windowApi).toContain('archiveInspection: ArchiveInspectionAPI');
    expect(preload).toContain("import { archiveInspection } from './preload/bridges/ArchiveInspectionBridge'");
    expect(preload).toMatch(/\barchiveInspection,\n}\n\ncontextBridge\.exposeInMainWorld\('api', api\)/);
  });
});
