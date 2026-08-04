// @vitest-environment jsdom

import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import type { ModpackConfig } from '../../../contexts/ModpackContext';
import type { ModpackMetadata } from '@shared/types/modpack';
import { buildModpackRuntimeSummary } from '../../../features/modpacks/hooks/useModpackRuntimeSummary';
import { ModpackDetailsHeader } from '../details/ModpackDetailsHeader';
import { ModpackDetailsSettingsTab } from '../details/ModpackDetailsSettingsTab';

vi.mock('../../ui/LazyImage', () => ({
  LazyImage: (props: { alt: string; className?: string; src?: string }) => (
    <img alt={props.alt} className={props.className} src={props.src} />
  ),
}));

const t = createTranslator('en');

const baseConfig: ModpackConfig = {
  id: 'dense-pack',
  name: 'Dense Pack',
  runtime: {
    minecraft: '1.20.1',
    modLoader: {
      type: 'forge',
      version: '47.2.0',
    },
  },
  game: {
    useOptiFine: true,
  },
};

const metadata: ModpackMetadata = {
  id: 'dense-pack',
  name: 'Dense Pack',
  version: '2026.04.18',
  source: 'local',
  minecraftVersion: '1.20.1',
  modLoader: {
    type: 'forge',
    version: '47.2.0',
  },
  createdAt: '2026-04-18T00:00:00.000Z',
  updatedAt: '2026-04-18T00:00:00.000Z',
};

function buildUpdatedRuntimeConfig(currentConfig: ModpackConfig, loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge'): ModpackConfig {
  const previousLoaderType = currentConfig.runtime.modLoader?.type ?? 'vanilla';
  const nextModLoader =
    previousLoaderType === loader
      ? currentConfig.runtime.modLoader ?? { type: loader }
      : loader === 'vanilla'
        ? { type: 'vanilla' as const }
        : { type: loader };

  return {
    ...currentConfig,
    runtime: {
      ...currentConfig.runtime,
      modLoader: nextModLoader,
    },
    game:
      loader === 'forge'
        ? currentConfig.game
        : {
            ...(currentConfig.game ?? {}),
            useOptiFine: false,
          },
  };
}

function SettingsHarness() {
  const [config, setConfig] = useState<ModpackConfig>(baseConfig);
  const runtimeSummary = buildModpackRuntimeSummary({
    config,
    metadata,
    optiFineVersions: ['1.20.1'],
  });

  return (
    <div>
      <ModpackDetailsHeader
        modpackName="Dense Pack"
        metadata={metadata}
        runtimeSummary={runtimeSummary}
        activeTab="settings"
        onTabChange={vi.fn()}
        t={t}
        getAccentStyles={() => ({ className: '', style: undefined })}
        getAccentHex={() => '#10b981'}
      />
      <ModpackDetailsSettingsTab
        effectiveConfig={config}
        runtimeSummary={runtimeSummary}
        setters={{
          setMemoryGb: vi.fn(async () => undefined),
          setMinMemoryGb: vi.fn(async () => undefined),
          setJavaPath: vi.fn(async () => undefined),
          setVmOptions: vi.fn(async () => undefined),
          setGameExtraArgs: vi.fn(async () => undefined),
          setGameResolution: vi.fn(async () => undefined),
          setAutoConnectServer: vi.fn(async () => undefined),
          setRuntimeMinecraft: vi.fn(async (minecraftVersion: string) => {
            setConfig((prev) => ({
              ...prev,
              runtime: {
                ...prev.runtime,
                minecraft: minecraftVersion,
              },
            }));
          }),
          setRuntimeLoader: vi.fn(async (loader) => {
            setConfig((prev) => buildUpdatedRuntimeConfig(prev, loader));
          }),
          setUseOptiFine: vi.fn(async (enabled: boolean) => {
            setConfig((prev) => ({
              ...prev,
              game: {
                ...(prev.game ?? {}),
                useOptiFine: enabled,
              },
            }));
          }),
        }}
        versions={[
          { id: '1.20.1', type: 'release' },
          { id: '1.19.4', type: 'release' },
        ]}
        forgeVersions={['1.20.1', '1.19.4']}
        fabricVersions={['1.20.1', '1.19.4']}
        neoForgeVersions={['1.20.1']}
        optiFineVersions={['1.20.1']}
        onRefresh={vi.fn(async () => undefined)}
        t={t}
        getAccentStyles={() => ({ className: '', style: undefined })}
      />
    </div>
  );
}

describe('Modpack details settings runtime summary', () => {
  it('keeps the header and settings summary aligned as runtime settings change', async () => {
    render(<SettingsHarness />);

    const headerMetadata = screen.getByTestId('modpack-details-metadata');
    expect(within(headerMetadata).getByText('1.20.1')).toBeTruthy();
    expect(within(headerMetadata).getByText('Forge 47.2.0')).toBeTruthy();

    expect(screen.getByTestId('modpack-dependency-count').textContent).toBe('3');
    expect(screen.getByTestId('modpack-dependency-status').getAttribute('data-tone')).toBe('healthy');
    expect(screen.getByText('Modloader Version')).toBeTruthy();
    expect(screen.getByText('47.2.0')).toBeTruthy();
    expect(screen.getByText('OptiFine')).toBeTruthy();
    expect(screen.queryByTestId('modpack-dependency-warnings')).toBeNull();

    fireEvent.change(screen.getByLabelText('Minecraft Version'), { target: { value: '1.19.4' } });

    await waitFor(() => {
      expect(screen.getByTestId('modpack-dependency-count').textContent).toBe('2');
    });
    expect(screen.queryByText('OptiFine')).toBeNull();
    expect(within(screen.getByTestId('modpack-details-metadata')).getByText('1.19.4')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Fabric' }));

    await waitFor(() => {
      expect(
        within(screen.getByTestId('modpack-dependency-summary')).getByText('Fabric'),
      ).toBeTruthy();
    });
    expect(within(screen.getByTestId('modpack-dependency-summary')).getByText('Modloader Version')).toBeTruthy();
    expect(within(screen.getByTestId('modpack-dependency-summary')).getByText('Unverified')).toBeTruthy();
    expect(screen.getByTestId('modpack-dependency-status').getAttribute('data-tone')).toBe('healthy');
    expect(within(screen.getByTestId('modpack-details-metadata')).getByText('Fabric')).toBeTruthy();
    expect(screen.queryByTestId('modpack-dependency-warnings')).toBeNull();
  });
});
