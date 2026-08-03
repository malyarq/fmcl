// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, waitFor } from '@testing-library/react';
import type { OperationSnapshot } from '@shared/contracts';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackUpdateModal } from '../ModpackUpdateModal';

const getModrinthVersionsMock = vi.fn();
const getCurseForgeVersionsMock = vi.fn();
const startMock = vi.fn();
const subscribeMock = vi.fn();
let operationListener: ((snapshot: OperationSnapshot) => void) | undefined;
const t = createTranslator('en');

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getModrinthVersions: (...args: unknown[]) => getModrinthVersionsMock(...args),
    getCurseForgeVersions: (...args: unknown[]) => getCurseForgeVersionsMock(...args),
  },
}));

vi.mock('../../../services/ipc/operationsIPC', () => ({
  operationsIPC: {
    start: (...args: unknown[]) => startMock(...args),
    subscribe: (...args: unknown[]) => subscribeMock(...args),
    cancel: vi.fn(),
  },
}));

const queuedUpdate: OperationSnapshot = {
  id: 'provider-update',
  kind: 'install-modrinth',
  status: 'queued',
  phase: 'started',
  progress: { completed: 0, total: 2 },
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const updateVersion = {
  platform: 'modrinth' as const,
  versionId: 'release-2',
  name: '1.2.0',
  versionNumber: '1.2.0',
  changelog: 'Bug fixes',
  mcVersions: ['1.20.1'],
  loaders: ['fabric'],
  files: [],
};

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('ModpackUpdateModal degraded states', () => {
  beforeEach(() => {
    getModrinthVersionsMock.mockReset();
    getCurseForgeVersionsMock.mockReset();
    operationListener = undefined;
    startMock.mockReset().mockResolvedValue(queuedUpdate);
    subscribeMock.mockReset().mockImplementation(async (_id: string, listener: (snapshot: OperationSnapshot) => void) => {
      operationListener = listener;
      return vi.fn();
    });
    mockMatchMedia();
  });

  it('shows a dedicated degraded error instead of treating failed version loading as no updates', async () => {
    getModrinthVersionsMock.mockRejectedValue(new Error('[modpacksIPC] getModrinthVersions failed: ${file.jarVersion}'));

    render(
      <ModpackUpdateModal
        modpackId="alpha"
        sourceId="alpha-pack"
        source="modrinth"
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Unable to load updates' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Needs attention');
    expect(screen.queryByText('No updates available')).toBeNull();
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull();
  });

  it('sanitizes suspicious version and changelog placeholders before rendering them', async () => {
    getModrinthVersionsMock.mockResolvedValue([
      {
        platform: 'modrinth',
        versionId: 'release-2',
        name: '${file.jarVersion}',
        versionNumber: '1.2.0',
        changelog: '${file.jarVersion}',
        mcVersions: ['1.20.1'],
        loaders: ['fabric'],
        files: [],
      },
    ]);

    render(
      <ModpackUpdateModal
        modpackId="alpha"
        sourceId="alpha-pack"
        source="modrinth"
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByRole('option', { name: '1.2.0 (1.20.1)' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Changelog unavailable' })).toBeTruthy();
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull();
  });

  it('keeps the review flow local to the modpack modal when updates are available', async () => {
    getModrinthVersionsMock.mockResolvedValue([updateVersion]);

    render(
      <ModpackUpdateModal
        modpackId="alpha"
        sourceId="alpha-pack"
        source="modrinth"
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText('Review modpack update')).toBeTruthy();
    expect(screen.getByTestId('modpack-update-modal').getAttribute('data-update-scope')).toBe('modpack-local');
    expect(screen.queryByText('Launcher update available')).toBeNull();
  });

  it('refreshes and closes only after a published degraded update snapshot', async () => {
    getModrinthVersionsMock.mockResolvedValue([updateVersion]);
    const onClose = vi.fn();
    const onUpdated = vi.fn();

    render(
      <ModpackUpdateModal
        modpackId="alpha"
        sourceId="alpha-pack"
        source="modrinth"
        isOpen
        onClose={onClose}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));
    await waitFor(() => expect(startMock).toHaveBeenCalledWith({
      kind: 'install-modrinth',
      projectId: 'alpha-pack',
      versionId: 'release-2',
      destinationId: 'alpha',
      rootPath: '/minecraft',
    }));

    act(() => operationListener?.({
      ...queuedUpdate,
      status: 'degraded',
      phase: 'completed',
      result: { status: 'degraded', missing: [{ path: 'mods/optional.jar', reason: 'not found' }] },
    }));

    await waitFor(() => expect(onUpdated).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not refresh or close after a failed provider update', async () => {
    getModrinthVersionsMock.mockResolvedValue([updateVersion]);
    const onClose = vi.fn();
    const onUpdated = vi.fn();

    render(
      <ModpackUpdateModal
        modpackId="alpha"
        sourceId="alpha-pack"
        source="modrinth"
        isOpen
        onClose={onClose}
        onUpdated={onUpdated}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));
    await waitFor(() => expect(operationListener).toBeTypeOf('function'));
    act(() => operationListener?.({
      ...queuedUpdate,
      status: 'failed',
      phase: 'failed',
      result: { status: 'failed', code: 'download-failed', message: 'Download failed' },
    }));

    expect(onUpdated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
