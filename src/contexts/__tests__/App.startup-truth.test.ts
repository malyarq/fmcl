// @vitest-environment jsdom

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { APP_STARTUP_PENDING_TEST_ID } from '../../App';
import { AppProviders } from '../../app/providers';
import type { AppLayoutProps } from '../../components/AppLayout';
import { CLASSIC_MODPACK_ID } from '../../../shared/constants';
import type { InstanceSnapshotDto } from '@shared/contracts';
import type { ModLoaderType } from '../instances/types';

const uiModeState = { value: 'simple' as 'simple' | 'modpacks' };
const minecraftPathState = { value: '/minecraft' };
const prepareMock = vi.fn();
const listMock = vi.fn();
const snapshotMock = vi.fn();
const appLayoutSpy = vi.fn();

function passthroughProvider(props: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, props.children);
}

vi.mock('../../contexts/SettingsContext', () => ({
  SettingsProvider: passthroughProvider,
  useSettings: () => ({
    minecraftPath: minecraftPathState.value,
    hideLauncher: false,
    showConsole: false,
    theme: 'dark' as const,
    sidebarPosition: 'left' as const,
    compactMode: false,
    disableAnimations: false,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    t: (key: string) => key,
  }),
  useUIMode: () => ({ uiMode: uiModeState.value, setMode: vi.fn() }),
}));

vi.mock('../../contexts/ToastContext', () => ({ ToastProvider: passthroughProvider }));
vi.mock('../../contexts/ConfirmContext', () => ({ ConfirmProvider: passthroughProvider }));
vi.mock('../../app/hooks/useAppIcon', () => ({ useAppIcon: () => ({ iconPath: '' }) }));
vi.mock('../../app/hooks/useAppOverlays', () => ({
  useAppOverlays: () => ({
    showSettings: false,
    showMultiplayer: false,
    openSettings: vi.fn(),
    closeSettings: vi.fn(),
    openMultiplayer: vi.fn(),
    closeMultiplayer: vi.fn(),
  }),
}));
vi.mock('../../app/hooks/useOnboarding', () => ({
  useOnboarding: () => ({
    showWelcome: false,
    showTour: false,
    handleWelcomeComplete: vi.fn(),
    handleTourStart: vi.fn(),
    handleTourComplete: vi.fn(),
    handleSkip: vi.fn(),
  }),
}));
vi.mock('../../app/hooks/useLaunchHandler', () => ({ useLaunchHandler: () => vi.fn() }));
vi.mock('../../features/launcher/hooks/useLauncher', () => ({
  useLauncher: () => ({
    isLaunching: false,
    progress: 0,
    launchStage: 'idle' as const,
    statusText: '',
    statusDetail: '',
    canForceRestart: false,
    logs: [],
    logEndRef: { current: null },
    handleLaunch: vi.fn(),
    copyLogs: vi.fn(),
  }),
}));
vi.mock('../../features/launcher/hooks/useVersions', () => ({ useVersions: () => ({ versions: [] }) }));
vi.mock('../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: ['1.12.2', '1.20.1'],
    fabricVersions: ['1.12.2', '1.20.1'],
    optiFineVersions: ['1.12.2', '1.20.1'],
    neoForgeVersions: ['1.12.2', '1.20.1'],
    isLoading: false,
  }),
}));
vi.mock('../../features/updater/hooks/useAppUpdater', () => ({
  useAppUpdater: () => ({ status: 'idle' as const, updateInfo: null, installUpdate: vi.fn() }),
}));
vi.mock('../../components/AppLayout', () => ({
  AppLayout: (props: AppLayoutProps) => {
    appLayoutSpy(props);
    return React.createElement('div', { 'data-testid': 'app-layout' }, `${props.launch.version}|${props.launch.loaderType}`);
  },
}));
vi.mock('../../components/ErrorBoundaryWrapper', () => ({ ErrorBoundaryWrapper: passthroughProvider }));
vi.mock('../../components/ConsoleWindow', () => ({ ConsoleWindow: () => React.createElement('div', null, 'Console') }));
vi.mock('../instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({ select: vi.fn(), create: vi.fn(), rename: vi.fn(), duplicate: vi.fn(), remove: vi.fn() }),
}));
vi.mock('../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    prepare: () => prepareMock(),
    list: () => listMock(),
    snapshot: (...args: unknown[]) => snapshotMock(...args),
    config: vi.fn(),
    select: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    metadata: vi.fn(),
  },
}));
function snapshot(id: string, name: string, minecraftVersion: string, loader: ModLoaderType): InstanceSnapshotDto {
  return {
    id,
    name,
    metadata: {
      source: 'local',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    },
    config: {
      runtime: { minecraftVersion, modLoader: { type: loader } },
      memory: { maxMb: 4096 },
      vmOptions: [],
    },
    summary: { minecraftVersion, modLoader: { type: loader } },
  };
}

function readyList(selected: InstanceSnapshotDto) {
  return {
    ok: true as const,
    value: {
      status: 'ready' as const,
      instances: [{ id: selected.id, name: selected.name, selected: true, summary: selected.summary }],
    },
  };
}

function readySnapshot(value: InstanceSnapshotDto) {
  return { ok: true as const, value };
}

describe('App canonical instance startup truth', () => {
  beforeEach(() => {
    uiModeState.value = 'simple';
    minecraftPathState.value = '/minecraft';
    prepareMock.mockReset();
    listMock.mockReset();
    snapshotMock.mockReset();
    appLayoutSpy.mockReset();
    localStorage.clear();
    window.location.hash = '';
    prepareMock.mockResolvedValue({ ok: true, value: { status: 'ready' } });
  });

  it('keeps the app startup-pending until the canonical classic snapshot resolves', async () => {
    const selected = snapshot('default', 'Default', '1.12.2', 'vanilla');
    const classic = snapshot(CLASSIC_MODPACK_ID, 'Classic', '1.20.1', 'fabric');
    let resolveClassic: ((value: ReturnType<typeof readySnapshot>) => void) | undefined;
    const classicPromise = new Promise<ReturnType<typeof readySnapshot>>((resolve) => { resolveClassic = resolve; });

    listMock.mockResolvedValue(readyList(selected));
    snapshotMock.mockImplementation(({ id }: { id: string }) => id === CLASSIC_MODPACK_ID ? classicPromise : readySnapshot(selected));

    render(React.createElement(AppProviders, null, React.createElement(App)));

    expect(screen.getByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeTruthy();
    await waitFor(() => {
      expect(snapshotMock).toHaveBeenCalledWith({ id: 'default' });
      expect(snapshotMock).toHaveBeenCalledWith({ id: CLASSIC_MODPACK_ID });
    });
    expect(screen.queryByTestId('app-layout')).toBeNull();

    resolveClassic?.(readySnapshot(classic));
    await waitFor(() => expect(screen.getByTestId('app-layout').textContent).toBe('1.20.1|fabric'));
  });

  it('uses path-free canonical queries without a renderer prepare fallback', async () => {
    minecraftPathState.value = '';
    const selected = snapshot('default', 'Default', '1.12.2', 'vanilla');
    const classic = snapshot(CLASSIC_MODPACK_ID, 'Classic', '1.20.1', 'fabric');
    listMock.mockResolvedValue(readyList(selected));
    snapshotMock.mockImplementation(({ id }: { id: string }) => readySnapshot(id === CLASSIC_MODPACK_ID ? classic : selected));

    render(React.createElement(AppProviders, null, React.createElement(App)));

    await waitFor(() => expect(screen.getByTestId('app-layout').textContent).toBe('1.20.1|fabric'));
    expect(prepareMock).not.toHaveBeenCalled();
    expect(listMock).toHaveBeenCalledWith();
    expect(snapshotMock).toHaveBeenCalledWith({ id: CLASSIC_MODPACK_ID });
  });

  it('does not invent a selected default while canonical state is uninitialized', async () => {
    uiModeState.value = 'modpacks';
    listMock.mockResolvedValue({ ok: true, value: { status: 'uninitialized' } });

    render(React.createElement(AppProviders, null, React.createElement(App)));

    await waitFor(() => expect(listMock).toHaveBeenCalledWith());
    expect(snapshotMock).not.toHaveBeenCalled();
    expect(screen.getByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeTruthy();
    expect(screen.queryByTestId('app-layout')).toBeNull();
  });
});
