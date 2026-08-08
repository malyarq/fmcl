// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import type { ModpackConfig } from '../../../contexts/instances/types';
import { ModpackDetails } from '../ModpackDetails';

const t = createTranslator('en');
const loadModpackConfigMock = vi.fn();
const refreshMock = vi.fn();
const selectMock = vi.fn();
const effectiveConfigRef: { current: ModpackConfig | null } = { current: null };

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({
    status: 'ready',
    data: [
      {
        id: 'runtime-pack',
        name: 'Runtime Pack',
        path: '/instances/runtime-pack',
      },
    ],
  }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../contexts/instances/hooks/useInstanceCrudActions', () => ({
  useInstanceCrudActions: () => ({
    select: (...args: unknown[]) => selectMock(...args),
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

vi.mock('../../../features/modpacks/hooks/useModpackDetailsConfig', () => ({
  useModpackDetailsConfig: () => ({
    effectiveConfig: effectiveConfigRef.current,
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

describe('Modpack details runtime truth', () => {
  beforeEach(() => {
    effectiveConfigRef.current = null;
    loadModpackConfigMock.mockReset();
    refreshMock.mockReset();
    selectMock.mockReset();
    loadModpackConfigMock.mockResolvedValue(undefined);
    refreshMock.mockResolvedValue(undefined);
    selectMock.mockResolvedValue(undefined);
  });

  it('shows runtime truth on the default details surface and guards metadata-to-config confirmation', () => {
    const metadata = {
      id: 'runtime-pack',
      name: 'Runtime Pack',
      version: '2026.04.18',
      minecraftVersion: '1.20.1',
      modLoader: {
        type: 'forge' as const,
      },
      source: 'modrinth' as const,
      createdAt: '2026-04-18T00:00:00.000Z',
      updatedAt: '2026-04-18T00:00:00.000Z',
      description: 'Runtime summary should be visible before opening settings.',
    };

    const view = render(
      <ModpackDetails
        modpackId="runtime-pack"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
        hydrateFromIpc={false}
        initialTab="info"
        initialMetadata={metadata}
      />,
    );

    expect(screen.getByTestId('modpack-details-runtime-panel')).toBeTruthy();
    expect(screen.getByText('Runtime and dependency state')).toBeTruthy();
    expect(screen.getByText('Burrow is still reading runtime details from pack metadata. Saved modpack settings can still replace this.')).toBeTruthy();
    expect(screen.getByTestId('modpack-dependency-status').textContent).toBe('Unverified');
    expect(screen.getByTestId('modpack-dependency-status').getAttribute('data-tone')).toBe('unverified');
    expect(within(screen.getByTestId('modpack-dependency-summary')).getByText('Forge')).toBeTruthy();

    effectiveConfigRef.current = {
      id: 'runtime-pack',
      name: 'Runtime Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: {
          type: 'forge',
          version: '47.2.0',
        },
      },
    };

    view.rerender(
      <ModpackDetails
        modpackId="runtime-pack"
        onBack={vi.fn()}
        onNavigate={vi.fn()}
        hydrateFromIpc={false}
        initialTab="info"
        initialMetadata={metadata}
      />,
    );

    expect(screen.getByText("Burrow is reading runtime details from this modpack's saved configuration.")).toBeTruthy();
    expect(screen.getByTestId('modpack-dependency-status').textContent).toBe('Ready');
    expect(screen.getByTestId('modpack-dependency-status').getAttribute('data-tone')).toBe('healthy');
    expect(within(screen.getByTestId('modpack-details-metadata')).getByText('Forge 47.2.0')).toBeTruthy();
    expect(screen.queryByText('Burrow is still reading runtime details from pack metadata. Saved modpack settings can still replace this.')).toBeNull();
  });
});
