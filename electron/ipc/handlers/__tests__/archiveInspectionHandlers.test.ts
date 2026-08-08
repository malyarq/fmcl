import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  showOpenDialog: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: { showOpenDialog: mocked.showOpenDialog },
  ipcMain: {
    removeHandler: (channel: string) => mocked.handlers.delete(channel),
    handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocked.handlers.set(channel, handler),
  },
}));

import { registerArchiveInspectionHandlers } from '../archiveInspectionHandlers';
import {
  clearArchiveReferenceAuthorizationsForTests,
  consumeArchiveReference,
} from '../../../security/archiveReferenceAuthorizations';

const archivePath = '/tmp/burrow-import.zip';
const inspection = {
  format: 'modrinth' as const,
  manifest: {
    formatVersion: 1,
    minecraft: { version: '1.20.1', modLoaders: [] },
    name: 'Safe import',
    version: '1.0.0',
    files: [],
  },
};

describe('archive inspection handlers', () => {
  const inspectArchive = vi.fn();

  beforeEach(() => {
    inspectArchive.mockReset();
    mocked.showOpenDialog.mockReset();
  });

  afterEach(() => {
    mocked.handlers.clear();
    clearArchiveReferenceAuthorizationsForTests();
    vi.useRealTimers();
  });

  it('selects and inspects an archive without exposing its filesystem path', async () => {
    mocked.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [archivePath] });
    inspectArchive.mockResolvedValue(inspection);
    registerArchiveInspectionHandlers({ window: {} as never, inspectArchive });

    const select = mocked.handlers.get('archiveInspection:select');
    const response = await select?.({ sender: { id: 7 } }) as {
      status: string;
      archiveRef: string;
      format: string | null;
      manifest: unknown;
    };

    expect(mocked.showOpenDialog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      properties: ['openFile'],
    }));
    expect(inspectArchive).toHaveBeenCalledWith(archivePath);
    expect(response).toMatchObject({ status: 'selected', format: 'modrinth', manifest: inspection.manifest });
    expect(response).not.toHaveProperty('filePath');
    expect(response).not.toHaveProperty('path');
    expect(response.archiveRef).toEqual(expect.any(String));
    expect(consumeArchiveReference(7, response.archiveRef)).toBe(archivePath);
  });

  it('does not inspect or authorize a cancelled native selection', async () => {
    mocked.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    registerArchiveInspectionHandlers({ window: {} as never, inspectArchive });

    const select = mocked.handlers.get('archiveInspection:select');
    await expect(select?.({ sender: { id: 7 } })).resolves.toEqual({ status: 'cancelled' });
    expect(inspectArchive).not.toHaveBeenCalled();
  });

  it('rejects forged, foreign, expired and replayed references before a later consumer can use a path', async () => {
    mocked.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [archivePath] });
    inspectArchive.mockResolvedValue(inspection);
    registerArchiveInspectionHandlers({ window: {} as never, inspectArchive });
    const select = mocked.handlers.get('archiveInspection:select');
    const selected = await select?.({ sender: { id: 7 } }) as { archiveRef: string };

    expect(() => consumeArchiveReference(7, 'forged-reference')).toThrow(/not authorized/i);
    expect(() => consumeArchiveReference(8, selected.archiveRef)).toThrow(/not authorized/i);

    vi.useFakeTimers();
    vi.advanceTimersByTime(5 * 60 * 1_000);
    expect(() => consumeArchiveReference(7, selected.archiveRef)).toThrow(/not authorized/i);

    vi.useRealTimers();
    mocked.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [archivePath] });
    const replayCandidate = await select?.({ sender: { id: 7 } }) as { archiveRef: string };
    expect(consumeArchiveReference(7, replayCandidate.archiveRef)).toBe(archivePath);
    expect(() => consumeArchiveReference(7, replayCandidate.archiveRef)).toThrow(/not authorized/i);
  });
});
