// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackDetails } from '../ModpackDetails';

const t = createTranslator('en');
const loadModpackConfigMock = vi.fn();
const refreshMock = vi.fn();
const selectMock = vi.fn();

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpack: () => ({
    modpacks: [
      {
        id: 'dense-pack',
        name: 'The Unreasonably Long Modpack Title That Used To Collapse The Details Header Under Desktop Pressure',
        path: '/instances/dense-pack',
      },
    ],
    select: (...args: unknown[]) => selectMock(...args),
    rename: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    refresh: (...args: unknown[]) => refreshMock(...args),
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

vi.mock('../../../features/modpacks/hooks/useModpackDetailsConfig', () => ({
  useModpackDetailsConfig: () => ({
    effectiveConfig: {
      runtime: {
        minecraft: '1.20.1',
        modLoader: {
          type: 'fabric',
          version: '0.16.9',
        },
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

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getMetadata: vi.fn(),
    getMods: vi.fn(),
    updateMetadata: vi.fn(),
    removeMod: vi.fn(),
    setModEnabled: vi.fn(),
    getCurseForgeVersions: vi.fn(),
    getModrinthVersions: vi.fn(),
  },
}));

describe('Modpack details density', () => {
  beforeEach(() => {
    loadModpackConfigMock.mockReset();
    refreshMock.mockReset();
    selectMock.mockReset();
    loadModpackConfigMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    selectMock.mockResolvedValue(undefined);
  });

  it('keeps metadata, tabs, and route actions as one labeled hierarchy under constrained width', () => {
    render(
      <div style={{ width: '960px' }}>
        <ModpackDetails
          modpackId="dense-pack"
          onBack={vi.fn()}
          onNavigate={vi.fn()}
          hydrateFromIpc={false}
          initialTab="info"
          initialMetadata={{
            id: 'dense-pack',
            name: 'The Unreasonably Long Modpack Title That Used To Collapse The Details Header Under Desktop Pressure',
            version: '2026.04.18-release-candidate-with-an-extraordinarily-long-runtime-name',
            minecraftVersion: '1.20.1',
            modLoader: {
              type: 'fabric',
              version: '0.16.9',
            },
            author: 'Dense Surface Quality Group',
            source: 'local',
            createdAt: '2026-04-18T00:00:00.000Z',
            updatedAt: '2026-04-18T00:00:00.000Z',
            description: 'A long-form modpack summary used to keep the details route under pressure.',
          }}
        />
      </div>,
    );

    const hero = screen.getByTestId('modpack-details-hero');
    expect(hero.className).toContain('xl:grid-cols-[minmax(0,1fr)_20rem]');

    const metadata = screen.getByTestId('modpack-details-metadata');
    expect(metadata.textContent).toContain('Version');
    expect(metadata.textContent).toContain('Minecraft Version');
    expect(metadata.textContent).toContain('Modloader');
    expect(metadata.textContent).toContain('Author');

    const tablist = screen.getByTestId('modpack-details-tablist');
    expect(tablist.className).toContain('grid');
    expect(screen.getByText('Manage mods, packs, shaders, and worlds from one consistent content workspace.')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Resource packs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Screenshots' })).toBeTruthy();

    const actions = screen.getByTestId('modpack-details-actions');
    expect(actions.textContent).toContain('More actions');
    expect(actions.textContent).toContain('Play');
    expect(document.querySelectorAll('[data-primary-action="route"]')).toHaveLength(1);
  });
});
