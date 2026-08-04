// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModPage } from '../AddModPage';

const searchModsMock = vi.fn();
const getModVersionsMock = vi.fn();
const installModFileMock = vi.fn();
const resourcePackAddMock = vi.fn();
const invalidateInstanceMock = vi.fn();
const onBackMock = vi.fn();
let instanceState: unknown;

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: createTranslator('en'),
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatNumber: (value: number) => new Intl.NumberFormat('en-US').format(value),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceSnapshot: () => instanceState,
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: (...args: unknown[]) => invalidateInstanceMock(...args),
    invalidateInstances: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: (...args: unknown[]) => getModVersionsMock(...args),
    installModFile: (...args: unknown[]) => installModFileMock(...args),
  },
}));

vi.mock('../../../services/ipc/resourcePacksIPC', () => ({
  resourcePacksIPC: {
    add: (...args: unknown[]) => resourcePackAddMock(...args),
  },
}));

vi.mock('../../../services/ipc/shadersIPC', () => ({
  shadersIPC: { add: vi.fn() },
}));

vi.mock('../../../contexts/instances/services/instancesService', () => ({
  fetchModpackMetadata: vi.fn().mockResolvedValue({ minecraftVersion: '1.12.2' }),
  fetchModpackConfig: vi.fn().mockResolvedValue({ runtime: { minecraft: '1.12.2' } }),
}));

describe('AddModPage resource-pack recovery', () => {
  beforeEach(() => {
    searchModsMock.mockReset();
    getModVersionsMock.mockReset();
    installModFileMock.mockReset();
    resourcePackAddMock.mockReset();
    invalidateInstanceMock.mockReset();
    onBackMock.mockReset();
    searchModsMock.mockResolvedValue({ items: [], total: 0 });
    invalidateInstanceMock.mockResolvedValue(undefined);
    instanceState = {
      status: 'ready',
      data: {
        id: 'alpha',
        name: 'Alpha Pack',
        runtime: { minecraft: '1.21.1', modLoader: { type: 'fabric', version: '0.16.9' } },
      },
    };
  });

  it('uses the canonical snapshot runtime and keeps the narrow shared acquisition workspace', async () => {
    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="resourcepack" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    expect(searchModsMock).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'resourcepack',
      mcVersion: '1.21.1',
    }));
    expect(searchModsMock.mock.calls[0]?.[0]).not.toHaveProperty('loader');
    const body = screen.getByTestId('add-mod-page-body');
    expect(body.querySelector('[data-secondary-content-workspace="shared"]')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Browse resource packs' })).toBeTruthy();
  });

  it('keeps a partial catalog commit visible, invalidates once and retries only the retained selection', async () => {
    searchModsMock.mockResolvedValue({
      items: [
        { platform: 'modrinth', projectId: 'faithful', title: 'Faithful 64x' },
        { platform: 'modrinth', projectId: 'fresh', title: 'Fresh Animations' },
      ],
      total: 2,
    });
    getModVersionsMock
      .mockResolvedValueOnce([{ platform: 'modrinth', versionId: 'faithful-v1', name: '1.0.0', mcVersions: ['1.21.1'], loaders: [] }])
      .mockResolvedValueOnce([{ platform: 'modrinth', versionId: 'fresh-v1', name: '1.0.0', mcVersions: ['1.21.1'], loaders: [] }]);
    installModFileMock
      .mockResolvedValueOnce({ status: 'success', filename: 'faithful.zip', issues: [] })
      .mockResolvedValueOnce({ status: 'duplicate', issues: [{ fileName: 'fresh.zip', status: 'duplicate', message: 'Already installed' }] })
      .mockResolvedValueOnce({ status: 'success', filename: 'fresh.zip', issues: [] });

    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="resourcepack" />);
    const faithful = await screen.findByRole('checkbox', { name: 'Faithful 64x' });
    const fresh = await screen.findByRole('checkbox', { name: 'Fresh Animations' });
    fireEvent.click(faithful);
    fireEvent.click(fresh);

    const install = await screen.findByRole('button', { name: 'Add selected resource packs (2)' });
    await waitFor(() => expect(install).toHaveProperty('disabled', false));
    fireEvent.click(install);

    const notice = await screen.findByTestId('add-mod-page-notice');
    expect(notice.getAttribute('data-acquisition-committed')).toBe('true');
    expect(notice.getAttribute('data-presentation-success')).toBe('false');
    expect(notice.textContent).toContain('Fresh Animations');
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(1);
    expect(invalidateInstanceMock).toHaveBeenCalledWith('alpha');
    expect(onBackMock).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /Fresh Animations/ })).toHaveProperty('checked', true);
    expect(screen.queryByRole('checkbox', { name: /Faithful 64x, selected/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onBackMock).toHaveBeenCalledTimes(1));
    expect(installModFileMock).toHaveBeenCalledTimes(3);
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes local partial commit, invalidates it and retries local failure through the import action', async () => {
    resourcePackAddMock
      .mockResolvedValueOnce({
        status: 'partial-success',
        importedFileNames: ['retro-clean.zip'],
        issues: [{ fileName: 'retro-broken.zip', status: 'invalid-archive', message: 'Missing pack.mcmeta' }],
      })
      .mockResolvedValueOnce({
        status: 'success',
        importedFileNames: ['retro-broken.zip'],
        issues: [],
      });

    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="resourcepack" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Import local .zip' }));

    const notice = await screen.findByTestId('add-mod-page-notice');
    expect(notice.getAttribute('data-tone')).toBe('warning');
    expect(notice.textContent).toContain('Added 1 resource packs.');
    expect(notice.textContent).toContain('retro-broken.zip');
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(1);
    expect(onBackMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(resourcePackAddMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onBackMock).toHaveBeenCalledTimes(1));
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(2);
  });

  it('keeps canonical loading and error states actionable in place', async () => {
    instanceState = { status: 'error', error: { code: 'INSTANCE_UNAVAILABLE', message: 'Alpha unavailable' } };

    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="resourcepack" />);

    const alert = screen.getByTestId('resourcepack-runtime-error');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Alpha unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(invalidateInstanceMock).toHaveBeenCalledWith('alpha'));
    expect(searchModsMock).not.toHaveBeenCalled();
  });
});
