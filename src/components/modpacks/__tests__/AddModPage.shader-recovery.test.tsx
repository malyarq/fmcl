// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModPage } from '../AddModPage';

const searchModsMock = vi.fn();
const getModVersionsMock = vi.fn();
const installModFileMock = vi.fn();
const shaderAddMock = vi.fn();
const invalidateInstanceMock = vi.fn();
const fetchModpackMetadataMock = vi.fn();
const fetchModpackConfigMock = vi.fn();
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

vi.mock('../../../services/ipc/shadersIPC', () => ({
  shadersIPC: {
    add: (...args: unknown[]) => shaderAddMock(...args),
  },
}));

vi.mock('../../../contexts/instances/services/instancesService', () => ({
  fetchModpackMetadata: (...args: unknown[]) => fetchModpackMetadataMock(...args),
  fetchModpackConfig: (...args: unknown[]) => fetchModpackConfigMock(...args),
}));

vi.mock('../../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [],
    fabricVersions: [],
    neoForgeVersions: [],
    optiFineVersions: ['1.21.1'],
    isLoading: false,
  }),
}));

describe('AddModPage shader recovery', () => {
  beforeEach(() => {
    searchModsMock.mockReset();
    getModVersionsMock.mockReset();
    installModFileMock.mockReset();
    shaderAddMock.mockReset();
    invalidateInstanceMock.mockReset();
    fetchModpackMetadataMock.mockReset();
    fetchModpackConfigMock.mockReset();
    onBackMock.mockReset();

    searchModsMock.mockResolvedValue({ items: [], total: 0 });
    invalidateInstanceMock.mockResolvedValue(undefined);
    fetchModpackMetadataMock.mockResolvedValue({ minecraftVersion: '1.12.2' });
    fetchModpackConfigMock.mockResolvedValue({ runtime: { minecraft: '1.12.2' } });
    instanceState = readyInstance();
  });

  it('uses canonical shader capability and does not leak a modloader filter into provider requests', async () => {
    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="shader" />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 550));
    });

    expect(searchModsMock).toHaveBeenCalledWith(expect.objectContaining({
      contentType: 'shader',
      mcVersion: '1.21.1',
    }));
    expect(searchModsMock.mock.calls[0]?.[0]).not.toHaveProperty('loader');
    expect(fetchModpackMetadataMock).not.toHaveBeenCalled();
    expect(fetchModpackConfigMock).not.toHaveBeenCalled();
    const guidance = screen.getByTestId('guided-content-shader-capability');
    expect(guidance.getAttribute('data-status')).toBe('supported');
    expect(guidance.textContent).toContain('Supported');
    expect(guidance.textContent).toContain('not compatibility guarantees');
  });

  it('keeps a partial provider commit visible and retries only the retained shader', async () => {
    searchModsMock.mockResolvedValue({
      items: [
        { platform: 'modrinth', projectId: 'complementary', title: 'Complementary Reimagined' },
        { platform: 'modrinth', projectId: 'makeup', title: 'MakeUp Ultra Fast' },
      ],
      total: 2,
    });
    getModVersionsMock
      .mockResolvedValueOnce([{ platform: 'modrinth', versionId: 'complementary-v1', name: '1.0.0', mcVersions: ['1.21.1'], loaders: [] }])
      .mockResolvedValueOnce([{ platform: 'modrinth', versionId: 'makeup-v1', name: '1.0.0', mcVersions: ['1.21.1'], loaders: [] }]);
    installModFileMock
      .mockResolvedValueOnce({ status: 'success', filename: 'complementary.zip', issues: [] })
      .mockResolvedValueOnce({ status: 'duplicate', issues: [{ fileName: 'makeup.zip', status: 'duplicate', message: 'Already installed' }] })
      .mockResolvedValueOnce({ status: 'success', filename: 'makeup.zip', issues: [] });

    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="shader" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Complementary Reimagined' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'MakeUp Ultra Fast' }));
    const install = await screen.findByRole('button', { name: 'Add selected shaders (2)' });
    await waitFor(() => expect(install).toHaveProperty('disabled', false));
    fireEvent.click(install);

    const notice = await screen.findByTestId('add-mod-page-notice');
    expect(notice.getAttribute('data-acquisition-committed')).toBe('true');
    expect(notice.getAttribute('data-presentation-success')).toBe('false');
    expect(notice.textContent).toContain('MakeUp Ultra Fast');
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(1);
    expect(onBackMock).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /MakeUp Ultra Fast/ })).toHaveProperty('checked', true);
    expect(screen.queryByRole('checkbox', { name: /Complementary Reimagined, selected/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onBackMock).toHaveBeenCalledTimes(1));
    expect(installModFileMock).toHaveBeenCalledTimes(3);
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes a partial local import and retries it through the same shared state machine', async () => {
    shaderAddMock
      .mockResolvedValueOnce({
        status: 'partial-success',
        importedFileNames: ['complementary.zip'],
        issues: [{ fileName: 'broken.zip', status: 'invalid-archive', message: 'Invalid shader archive' }],
      })
      .mockResolvedValueOnce({
        status: 'success',
        importedFileNames: ['broken.zip'],
        issues: [],
      });

    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="shader" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Import local .zip' }));

    const notice = await screen.findByTestId('add-mod-page-notice');
    expect(notice.getAttribute('data-tone')).toBe('warning');
    expect(notice.textContent).toContain('Added 1 shader packs.');
    expect(notice.textContent).toContain('broken.zip');
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(1);
    expect(onBackMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(shaderAddMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onBackMock).toHaveBeenCalledTimes(1));
    expect(invalidateInstanceMock).toHaveBeenCalledTimes(2);
  });

  it('blocks unsupported canonical runtime before download and keeps recovery on the page', async () => {
    instanceState = readyInstance({ loader: 'fabric', useOptiFine: true });
    searchModsMock.mockResolvedValue({
      items: [{ platform: 'modrinth', projectId: 'complementary', title: 'Complementary Reimagined' }],
      total: 1,
    });
    getModVersionsMock.mockResolvedValue([
      { platform: 'modrinth', versionId: 'complementary-v1', name: '1.0.0', mcVersions: ['1.21.1'], loaders: [] },
    ]);

    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="shader" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Complementary Reimagined' }));
    const install = await screen.findByRole('button', { name: 'Add selected shaders (1)' });
    await waitFor(() => expect(install).toHaveProperty('disabled', false));
    fireEvent.click(install);

    const notice = await screen.findByTestId('add-mod-page-notice');
    expect(screen.getByTestId('guided-content-shader-capability').getAttribute('data-status')).toBe('unsupported');
    expect(notice.getAttribute('data-tone')).toBe('error');
    expect(notice.textContent).toContain('blocked for the current runtime');
    expect(installModFileMock).not.toHaveBeenCalled();
    expect(invalidateInstanceMock).not.toHaveBeenCalled();
    expect(onBackMock).not.toHaveBeenCalled();
  });

  it('keeps canonical failure actionable without starting catalog search', async () => {
    instanceState = {
      status: 'error',
      error: { code: 'INSTANCE_UNAVAILABLE', message: 'Alpha unavailable' },
    };

    render(<AddModPage modpackId="alpha" onBack={onBackMock} contentType="shader" />);

    const alert = screen.getByTestId('shader-runtime-error');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Alpha unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(invalidateInstanceMock).toHaveBeenCalledWith('alpha'));
    expect(searchModsMock).not.toHaveBeenCalled();
  });
});

function readyInstance(options: { loader?: 'forge' | 'fabric'; useOptiFine?: boolean } = {}) {
  return {
    status: 'ready',
    data: {
      id: 'alpha',
      name: 'Alpha Pack',
      runtime: {
        minecraft: '1.21.1',
        modLoader: { type: options.loader ?? 'forge', version: '1.0.0' },
      },
      game: {
        useOptiFine: options.useOptiFine ?? true,
      },
    },
  };
}
