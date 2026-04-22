// @vitest-environment jsdom

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App, { APP_STARTUP_PENDING_TEST_ID } from '../../App';
import { AppProviders } from '../../app/providers';
import type { AppLayoutProps } from '../../components/AppLayout';
import { CLASSIC_MODPACK_ID } from '../../../shared/constants';
import type { ModpackConfig, ModpackListItem, ModLoaderType } from '../instances/types';

const uiModeState = { value: 'simple' as 'simple' | 'modpacks' };
const minecraftPathState = { value: '/minecraft' };
const bootstrapMock = vi.fn();
const listMock = vi.fn();
const getSelectedMock = vi.fn();
const fetchConfigMock = vi.fn();
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
  useUIMode: () => ({
    uiMode: uiModeState.value,
    setMode: vi.fn(),
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  ToastProvider: passthroughProvider,
}));

vi.mock('../../contexts/ConfirmContext', () => ({
  ConfirmProvider: passthroughProvider,
}));

vi.mock('../../app/hooks/useAppIcon', () => ({
  useAppIcon: () => ({ iconPath: '' }),
}));

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
    handleTourComplete: vi.fn(),
    handleSkip: vi.fn(),
  }),
}));

vi.mock('../../app/hooks/useLaunchHandler', () => ({
  useLaunchHandler: () => vi.fn(),
}));

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

vi.mock('../../features/launcher/hooks/useVersions', () => ({
  useVersions: () => ({ versions: [] }),
}));

vi.mock('../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [],
    fabricVersions: [],
    optiFineVersions: [],
    neoForgeVersions: [],
    isLoading: false,
  }),
}));

vi.mock('../../features/updater/hooks/useAppUpdater', () => ({
  useAppUpdater: () => ({
    status: 'idle' as const,
    updateInfo: null,
    installUpdate: vi.fn(),
  }),
}));

vi.mock('../../features/launch/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false }),
}));

vi.mock('../../features/launch/services/launchPersistence', () => ({
  loadNickname: () => 'Steve',
  saveNickname: vi.fn(),
}));

vi.mock('../../features/launch/services/launchValidation', () => ({
  computeLaunchVersion: ({ mcVersion }: { mcVersion: string }) => mcVersion,
  isLoaderSupported: () => true,
  shouldDisableOptiFine: () => false,
}));

vi.mock('../../components/AppLayout', () => ({
  AppLayout: (props: AppLayoutProps) => {
    appLayoutSpy(props);
    return React.createElement(
      'div',
      { 'data-testid': 'app-layout' },
      `${props.launch.version}|${props.launch.loaderType}`,
    );
  },
}));

vi.mock('../../components/ErrorBoundaryWrapper', () => ({
  ErrorBoundaryWrapper: passthroughProvider,
}));

vi.mock('../../components/ConsoleWindow', () => ({
  ConsoleWindow: () => React.createElement('div', null, 'Console'),
}));

vi.mock('../instances/hooks/useInstanceConfigPersistence', () => ({
  useInstanceConfigPersistence: () => ({
    saveConfig: vi.fn(),
    patchConfig: vi.fn(),
    setMemoryGb: vi.fn(),
    setMinMemoryGb: vi.fn(),
    setJavaPath: vi.fn(),
    setRuntimeMinecraft: vi.fn(),
    setRuntimeLoader: vi.fn(),
    setNetworkMode: vi.fn(),
    setVmOptions: vi.fn(),
    setGameExtraArgs: vi.fn(),
    setGameResolution: vi.fn(),
    setAutoConnectServer: vi.fn(),
  }),
}));

vi.mock('../instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({
    select: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock('../instances/hooks/useInstanceNetworkModeSync', () => ({
  useInstanceNetworkModeSync: vi.fn(),
}));

vi.mock('../instances/services/instancesService', () => ({
  bootstrapModpacksIfSupported: (...args: unknown[]) => bootstrapMock(...args),
  listModpacks: (...args: unknown[]) => listMock(...args),
  getSelectedModpackId: (...args: unknown[]) => getSelectedMock(...args),
  fetchModpackConfig: (...args: unknown[]) => fetchConfigMock(...args),
  saveModpackConfig: vi.fn(),
}));

function createConfig(
  id: string,
  name: string,
  minecraft: string,
  loader: ModLoaderType,
): ModpackConfig {
  return {
    id,
    name,
    runtime: {
      minecraft,
      modLoader: { type: loader },
    },
    memory: { maxMb: 4096 },
    vmOptions: [],
    createdAt: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  };
}

describe('ModpackContext startup truth', () => {
  beforeEach(() => {
    uiModeState.value = 'simple';
    minecraftPathState.value = '/minecraft';
    bootstrapMock.mockReset();
    listMock.mockReset();
    getSelectedMock.mockReset();
    fetchConfigMock.mockReset();
    appLayoutSpy.mockReset();
    localStorage.clear();
    window.location.hash = '';
  });

  it('keeps the app in a startup-pending state until classic config truth resolves', async () => {
    const selectedConfig = createConfig('default', 'Default', '1.12.2', 'vanilla');
    const classicConfig = createConfig(CLASSIC_MODPACK_ID, 'Classic', '1.20.1', 'fabric');
    const modpacks: ModpackListItem[] = [
      { id: 'default', name: 'Default', path: '/minecraft/default', selected: true },
    ];

    let resolveClassic: ((config: ModpackConfig) => void) | undefined;
    const classicConfigPromise = new Promise<ModpackConfig>((resolve) => {
      resolveClassic = resolve;
    });

    bootstrapMock.mockResolvedValue(null);
    listMock.mockResolvedValue(modpacks);
    getSelectedMock.mockResolvedValue('default');
    fetchConfigMock.mockImplementation((id: string) => {
      if (id === CLASSIC_MODPACK_ID) {
        return classicConfigPromise;
      }

      return Promise.resolve(selectedConfig);
    });

    render(React.createElement(AppProviders, null, React.createElement(App)));

    expect(screen.getByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeTruthy();

    await waitFor(() => {
      expect(fetchConfigMock).toHaveBeenCalledWith('default', '/minecraft');
      expect(fetchConfigMock).toHaveBeenCalledWith(CLASSIC_MODPACK_ID, '/minecraft');
    });

    expect(screen.getByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeTruthy();
    expect(screen.queryByTestId('app-layout')).toBeNull();
    expect(appLayoutSpy).not.toHaveBeenCalled();

    resolveClassic?.(classicConfig);

    await waitFor(() => {
      expect(screen.getByTestId('app-layout').textContent).toBe('1.20.1|fabric');
    });

    expect(screen.queryByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeNull();
  });

  it('boots classic mode against the default root path when minecraftPath is unset', async () => {
    minecraftPathState.value = '';

    const selectedConfig = createConfig('default', 'Default', '1.12.2', 'vanilla');
    const classicConfig = createConfig(CLASSIC_MODPACK_ID, 'Classic', '1.20.1', 'fabric');
    const modpacks: ModpackListItem[] = [
      { id: 'default', name: 'Default', path: '/minecraft/default', selected: true },
    ];

    bootstrapMock.mockResolvedValue(null);
    listMock.mockResolvedValue(modpacks);
    getSelectedMock.mockResolvedValue('default');
    fetchConfigMock.mockImplementation((id: string, rootPath?: string) => {
      expect(rootPath).toBeUndefined();

      if (id === CLASSIC_MODPACK_ID) {
        return Promise.resolve(classicConfig);
      }

      return Promise.resolve(selectedConfig);
    });

    render(React.createElement(AppProviders, null, React.createElement(App)));

    expect(screen.getByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeTruthy();

    await waitFor(() => {
      expect(fetchConfigMock).toHaveBeenCalledWith(CLASSIC_MODPACK_ID, undefined);
      expect(screen.getByTestId('app-layout').textContent).toBe('1.20.1|fabric');
    });

    expect(screen.queryByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeNull();
  });

  it('clears stale selected runtime labels while persisted truth reloads for a new root path', async () => {
    uiModeState.value = 'modpacks';

    const alphaConfig = createConfig('alpha', 'Alpha', '1.20.1', 'fabric');
    const betaConfig = createConfig('beta', 'Beta', '1.21.1', 'neoforge');
    const alphaModpacks: ModpackListItem[] = [
      { id: 'alpha', name: 'Alpha', path: '/minecraft/alpha', selected: true },
    ];
    const betaModpacks: ModpackListItem[] = [
      { id: 'beta', name: 'Beta', path: '/minecraft-alt/beta', selected: true },
    ];

    let resolveBetaConfig: ((config: ModpackConfig) => void) | undefined;
    const betaConfigPromise = new Promise<ModpackConfig>((resolve) => {
      resolveBetaConfig = resolve;
    });

    bootstrapMock.mockResolvedValue(null);
    listMock.mockImplementation((rootPath?: string) =>
      Promise.resolve(rootPath === '/minecraft-alt' ? betaModpacks : alphaModpacks),
    );
    getSelectedMock.mockImplementation((rootPath?: string) =>
      Promise.resolve(rootPath === '/minecraft-alt' ? 'beta' : 'alpha'),
    );
    fetchConfigMock.mockImplementation((id: string, rootPath?: string) => {
      if (rootPath === '/minecraft-alt' && id === 'beta') {
        return betaConfigPromise;
      }

      if (id === 'alpha') {
        return Promise.resolve(alphaConfig);
      }

      throw new Error(`Unexpected config lookup for ${id} at ${rootPath}`);
    });

    const view = render(React.createElement(AppProviders, null, React.createElement(App)));

    await waitFor(() => {
      expect(screen.getByTestId('app-layout').textContent).toBe('1.20.1|fabric');
    });

    minecraftPathState.value = '/minecraft-alt';
    view.rerender(React.createElement(AppProviders, null, React.createElement(App)));

    await waitFor(() => {
      expect(getSelectedMock).toHaveBeenCalledWith('/minecraft-alt');
      expect(fetchConfigMock).toHaveBeenCalledWith('beta', '/minecraft-alt');
    });

    expect(screen.getByTestId(APP_STARTUP_PENDING_TEST_ID)).toBeTruthy();
    expect(screen.queryByTestId('app-layout')).toBeNull();

    resolveBetaConfig?.(betaConfig);

    await waitFor(() => {
      expect(screen.getByTestId('app-layout').textContent).toBe('1.21.1|neoforge');
    });

    expect(appLayoutSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        launch: expect.objectContaining({ version: '1.12.2', loaderType: 'vanilla' }),
      }),
    );
  });
});
