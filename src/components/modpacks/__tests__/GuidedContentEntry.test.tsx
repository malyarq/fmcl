// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimplePlayDashboard } from '../../SimplePlayDashboard';
import { ModpackDetails } from '../ModpackDetails';
import { ModpackRouter } from '../ModpackRouter';
import { ModpackNavigationProvider } from '../../../features/modpacks/navigation/ModpackNavigationProvider';

const setModeMock = vi.fn();
const loadModpackConfigMock = vi.fn();

const translations: Record<string, string> = {
  'ui_mode.simple': 'Classic',
  'general.settings': 'Settings',
  'general.back': 'Back',
  'general.cancel': 'Cancel',
  'general.modloader': 'Modloader',
  'general.offline': 'Offline',
  'dashboard.welcome': 'Welcome',
  'dashboard.welcome_title': 'Welcome to Burrow!',
  'dashboard.welcome_desc': 'Simple Play mode is the fastest way to launch Minecraft.',
  'dashboard.dismiss': 'Got it',
  'dashboard.quick_actions': 'Quick actions',
  'dashboard.welcome_cta': 'Choose version and nickname in the sidebar, then press Play to start.',
  'dashboard.go_to_modpacks': 'Go to Modpacks',
  'dashboard.info_panel': 'Current settings',
  'dashboard.current_settings': 'Current settings',
  'dashboard.ram': 'RAM',
  'dashboard.connection': 'Connection',
  'dashboard.advanced_settings': 'Advanced settings',
  'dashboard.content': 'Content',
  'dashboard.classic_surface_desc': 'Classic dashboard',
  'modpacks.title': 'Modpacks',
  'modpacks.details_title': 'Modpack details',
  'modpacks.minecraft_version': 'Minecraft version',
  'modpacks.tab_mods': 'Mods',
  'modpacks.tab_resourcepacks': 'Resource Packs',
  'modpacks.tab_shaders': 'Shaders',
  'modpacks.tab_worlds': 'Worlds',
  'modpacks.secondary_content_description': 'Manage mods, packs, shaders, and worlds from one consistent content workspace.',
};

function translate(key: string) {
  return translations[key] ?? key;
}

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

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: translate,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    minecraftPath: '/minecraft',
    disableAnimations: false,
  }),
  useUIMode: () => ({
    uiMode: 'simple',
    setMode: (...args: unknown[]) => setModeMock(...args),
  }),
}));

vi.mock('../../../features/instances/hooks/useEffectiveInstance', () => ({
  useEffectiveInstance: () => ({
    status: 'ready',
    data: {
      id: 'classic',
      snapshot: {
        id: 'classic',
        name: 'Classic Pack',
        runtime: {
          minecraft: '1.20.1',
          modLoader: { type: 'fabric', version: '0.16.9' },
        },
        memory: { maxMb: 4096 },
      },
    },
  }),
}));

vi.mock('../../../features/instances/hooks/useInstanceConfigCommands', () => ({
  useInstanceConfigCommands: () => ({
    setMemoryGb: vi.fn(),
    setMinMemoryGb: vi.fn(),
    setVmOptions: vi.fn(),
    setGameExtraArgs: vi.fn(),
    setGameResolution: vi.fn(),
    setAutoConnectServer: vi.fn(),
  }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({ invalidateInstance: vi.fn(), invalidateInstances: vi.fn() }),
}));

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({
    status: 'ready',
    data: [
      { id: 'classic', name: 'Classic Pack', selected: false },
      { id: 'alpha', name: 'Alpha Pack', selected: true },
    ],
  }),
  useSelectedInstanceId: () => ({ status: 'ready', data: 'alpha' }),
}));

vi.mock('../../../contexts/instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({
    select: vi.fn(),
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
    prompt: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    snapshot: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        id: 'classic',
        name: 'Classic Pack',
        metadata: {
          source: 'local',
          createdAt: '2026-04-13T00:00:00.000Z',
          updatedAt: '2026-04-13T00:00:00.000Z',
        },
        config: {
          runtime: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } },
          memory: { maxMb: 4096 },
        },
        summary: { minecraftVersion: '1.20.1', modLoader: { type: 'fabric' } },
      },
    }),
  },
}));

vi.mock('../../settings/tabs/GameTab', () => ({
  GameTab: () => <div>Game tab</div>,
}));

vi.mock('../../ui/CollapsibleSection', () => ({
  CollapsibleSection: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock('../../branding/BrandMark', () => ({
  BrandMark: () => <div>Brand mark</div>,
}));

vi.mock('../../ui/ProgressBar', () => ({
  ProgressBar: () => <div>Progress bar</div>,
}));

vi.mock('../../modpacks/details/ModsTab', () => ({
  ModsTab: () => <div>Mods tab</div>,
}));

vi.mock('../../modpacks/details/ResourcePacksTab', () => ({
  ResourcePacksTab: ({ onAddResourcePack }: { onAddResourcePack?: () => void }) => (
    <button type="button" onClick={onAddResourcePack}>
      Open resource pack guided browser
    </button>
  ),
}));

vi.mock('../../modpacks/details/ShadersTab', () => ({
  ShadersTab: ({ onAddShader }: { onAddShader?: () => void }) => (
    <button type="button" onClick={onAddShader}>
      Open shader guided browser
    </button>
  ),
}));

vi.mock('../../modpacks/details/WorldsTab', () => ({
  WorldsTab: () => <div>Worlds tab</div>,
}));

vi.mock('../ModpackList', () => ({
  ModpackList: () => <div>Modpack list</div>,
}));

vi.mock('../ModpackBrowser', () => ({
  ModpackBrowser: () => <div>Modpack browser</div>,
}));

vi.mock('../AddModPage', () => ({
  AddModPage: ({ modpackId, contentType = 'mod' }: { modpackId: string; contentType?: 'mod' | 'resourcepack' | 'shader' }) => (
    <div>{`guided:${contentType}:${modpackId}`}</div>
  ),
}));

vi.mock('../details', () => ({
  getModpackDetailsPanelId: (tab: string) => `modpack-details-panel-${tab}`,
  getModpackDetailsTabId: (tab: string) => `modpack-details-tab-${tab}`,
  ModpackDetailsHeader: () => <div>Header</div>,
  ModpackDetailsInfoTab: () => <div>Info</div>,
  ModpackDetailsModsTab: () => <div>Mods</div>,
  ModpackDetailsSettingsTab: () => <div>Settings</div>,
  ModpackDetailsActions: () => <section data-testid="modpack-details-actions" />,
  ResourcePacksTab: ({ onAddResourcePack }: { onAddResourcePack?: () => void }) => (
    <button type="button" onClick={onAddResourcePack}>
      Open resource pack guided browser
    </button>
  ),
  ShadersTab: ({ onAddShader }: { onAddShader?: () => void }) => (
    <button type="button" onClick={onAddShader}>
      Open shader guided browser
    </button>
  ),
  WorldsTab: () => <div>Worlds</div>,
}));

vi.mock('../../../features/modpacks/hooks/useModpackDetailsConfig', () => ({
  useModpackDetailsConfig: () => ({
    effectiveConfig: {
      runtime: {
        minecraft: '1.20.1',
        modLoader: { type: 'fabric', version: '0.16.9' },
      },
    },
    loadModpackConfig: (...args: unknown[]) => loadModpackConfigMock(...args),
    setters: {},
  }),
}));

vi.mock('../../../features/launcher/hooks/useVersions', () => ({
  useVersions: () => ({
    versions: [],
  }),
}));

vi.mock('../../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [],
    fabricVersions: [],
    neoForgeVersions: [],
    optiFineVersions: [],
  }),
}));

vi.mock('../../../features/screenshots/components/ScreenshotsTab', () => ({
  ScreenshotsTab: () => <div>Screenshots</div>,
}));

describe('guided content entry', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia();
    setModeMock.mockReset();
    loadModpackConfigMock.mockReset();
    loadModpackConfigMock.mockResolvedValue(undefined);
  });

  it('routes simple-dashboard resource-pack entry into the same guided browser route', async () => {
    const view = render(
      <ModpackNavigationProvider>
        <SimplePlayDashboard
          launch={{
            version: '1.20.1',
            nickname: 'Steve',
            loaderType: 'fabric',
            ram: 6,
            isOffline: true,
          }}
          runtime={{
            isLaunching: false,
            onLaunch: vi.fn(),
          }}
          actions={{
            onShowMultiplayer: vi.fn(),
            onShowSettings: vi.fn(),
          }}
        />
      </ModpackNavigationProvider>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Resource Packs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open resource pack guided browser' }));

    expect(setModeMock).toHaveBeenCalledWith('modpacks');

    view.rerender(<ModpackNavigationProvider><ModpackRouter /></ModpackNavigationProvider>);

    expect(await screen.findByText('guided:resourcepack:classic')).toBeTruthy();
    expect(screen.queryByText('Modpack browser')).toBeNull();
  });

  it('routes simple-dashboard shader entry into the same guided browser route', async () => {
    const view = render(
      <ModpackNavigationProvider>
        <SimplePlayDashboard
          launch={{
            version: '1.20.1',
            nickname: 'Steve',
            loaderType: 'fabric',
            ram: 6,
            isOffline: true,
          }}
          runtime={{
            isLaunching: false,
            onLaunch: vi.fn(),
          }}
          actions={{
            onShowMultiplayer: vi.fn(),
            onShowSettings: vi.fn(),
          }}
        />
      </ModpackNavigationProvider>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Shaders' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open shader guided browser' }));

    expect(setModeMock).toHaveBeenCalledWith('modpacks');

    view.rerender(<ModpackNavigationProvider><ModpackRouter /></ModpackNavigationProvider>);

    expect(await screen.findByText('guided:shader:classic')).toBeTruthy();
    expect(screen.queryByText('Modpack browser')).toBeNull();
  });

  it('keeps modpack details resource-pack entry on the route-owned guided browser view', () => {
    const onNavigate = vi.fn();

    render(
      <ModpackDetails
        modpackId="alpha"
        onBack={vi.fn()}
        onNavigate={onNavigate}
        initialTab="resourcepacks"
        initialMetadata={{
          id: 'alpha',
          name: 'Alpha Pack',
          source: 'local',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          createdAt: '2026-04-13T00:00:00.000Z',
          updatedAt: '2026-04-13T00:00:00.000Z',
        }}
        hydrateFromIpc={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open resource pack guided browser' }));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'addResourcePack', modpackId: 'alpha' });
  });

  it('keeps modpack details shader entry on the route-owned guided browser view', () => {
    const onNavigate = vi.fn();

    render(
      <ModpackDetails
        modpackId="alpha"
        onBack={vi.fn()}
        onNavigate={onNavigate}
        initialTab="shaders"
        initialMetadata={{
          id: 'alpha',
          name: 'Alpha Pack',
          source: 'local',
          minecraftVersion: '1.20.1',
          modLoader: { type: 'fabric' },
          createdAt: '2026-04-13T00:00:00.000Z',
          updatedAt: '2026-04-13T00:00:00.000Z',
        }}
        hydrateFromIpc={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open shader guided browser' }));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'addShader', modpackId: 'alpha' });
  });
});
