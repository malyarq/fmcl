// @vitest-environment jsdom

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageSettings } from '../tabs/StorageTab';

const getContentStatsMock = vi.fn();

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

describe('StorageTab layout', () => {
  beforeEach(() => {
    getContentStatsMock.mockReset();
    getContentStatsMock.mockResolvedValue({
      totalSize: 1024 * 1024,
      dedupedSize: 512 * 1024,
      totalFiles: 42,
      storedFiles: 21,
    });
  });

  it('drops the standalone storage hero when embedded inside SettingsPage', async () => {
    render(
      <StorageSettings
        embedded
        t={(key) =>
          ({
            'settings.storage.title': 'Storage',
            'settings.storage.description': 'Track deduplicated content usage and clean up stored files that are no longer needed.',
            'settings.storage.cleanup': 'Cleanup',
            'settings.storage.cleanupDesc': 'Remove unreferenced stored files.',
            'settings.storage.cleanupBtn': 'Run cleanup',
            'settings.storage.totalSize': 'Total size',
            'settings.storage.savedSize': 'Saved size',
            'settings.storage.storedFiles': 'Stored files',
            'settings.storage.totalLogicalFiles': 'Logical files',
            'general.cancel': 'Cancel',
          }[key] ?? key)
        }
        getAccentStyles={() => ({ className: '', style: undefined })}
        modpacksIPC={{
          getContentStats: (...args: unknown[]) => getContentStatsMock(...args),
          cleanupContent: vi.fn(),
        } as never}
      />,
    );

    await waitFor(() => expect(getContentStatsMock).toHaveBeenCalledOnce());
    await screen.findByText('Cleanup');

    expect(screen.queryByRole('heading', { name: 'Storage' })).toBeNull();
    expect(screen.getByText('Cleanup')).toBeTruthy();
    expect(screen.getByText('Total size')).toBeTruthy();
  });
});
