import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import type { ModpackConfig } from '../../../contexts/instances/types';
import type { ModpackMetadata } from '@shared/types/modpack';
import {
  buildModpackRuntimeSummary,
  getModpackShaderCapabilityDescription,
  getModpackShaderCapabilityLabel,
  getModpackRuntimeLoaderLabel,
} from '../hooks/useModpackRuntimeSummary';

const t = createTranslator('en');

describe('buildModpackRuntimeSummary', () => {
  it('prefers effective config truth over stale metadata', () => {
    const config: ModpackConfig = {
      id: 'runtime-pack',
      name: 'Runtime Pack',
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
      id: 'runtime-pack',
      name: 'Runtime Pack',
      source: 'local',
      minecraftVersion: '1.19.4',
      modLoader: {
        type: 'fabric',
        version: '0.15.0',
      },
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    };

    const summary = buildModpackRuntimeSummary({
      config,
      metadata,
      optiFineVersions: ['1.20.1'],
    });

    expect(summary.source).toBe('config');
    expect(summary.status).toBe('healthy');
    expect(summary.minecraftVersion).toBe('1.20.1');
    expect(summary.modLoader).toEqual({ type: 'forge', version: '47.2.0' });
    expect(summary.requestedOptiFine).toBe(true);
    expect(summary.useOptiFine).toBe(true);
    expect(summary.shaderCapability).toEqual({
      status: 'supported',
      reason: 'optifine_enabled',
      warnings: [],
    });
    expect(getModpackShaderCapabilityLabel(summary.shaderCapability.status, t)).toBe('Supported');
    expect(getModpackShaderCapabilityDescription(summary, t)).toContain('Individual shader packs can still be incompatible');
    expect(getModpackRuntimeLoaderLabel(summary, t)).toBe('Forge 47.2.0');
  });

  it('falls back to metadata when config truth is unavailable', () => {
    const metadata: ModpackMetadata = {
      id: 'metadata-pack',
      name: 'Metadata Pack',
      source: 'modrinth',
      minecraftVersion: '1.19.4',
      modLoader: {
        type: 'fabric',
      },
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
    };

    const summary = buildModpackRuntimeSummary({ metadata });

    expect(summary.source).toBe('metadata');
    expect(summary.status).toBe('healthy');
    expect(summary.minecraftVersion).toBe('1.19.4');
    expect(summary.modLoader).toEqual({ type: 'fabric', version: undefined });
    expect(summary.shaderCapability).toEqual({
      status: 'unverified',
      reason: 'runtime_source_unverified',
      warnings: [],
    });
    expect(getModpackShaderCapabilityLabel(summary.shaderCapability.status, t)).toBe('Unverified');
    expect(getModpackShaderCapabilityDescription(summary, t)).toContain('metadata');
    expect(getModpackRuntimeLoaderLabel(summary, t)).toBe('Fabric');
  });

  it('keeps unsupported optifine requests in warning state instead of pretending they are healthy', () => {
    const config: ModpackConfig = {
      id: 'warning-pack',
      name: 'Warning Pack',
      runtime: {
        minecraft: '1.18.2',
        modLoader: {
          type: 'forge',
          version: '40.1.0',
        },
      },
      game: {
        useOptiFine: true,
      },
    };

    const summary = buildModpackRuntimeSummary({
      config,
      optiFineVersions: ['1.20.1'],
    });

    expect(summary.status).toBe('warning');
    expect(summary.requestedOptiFine).toBe(true);
    expect(summary.runtime.warnings).toContain('optifine_requires_supported_version');
    expect(summary.useOptiFine).toBe(false);
    expect(summary.shaderCapability).toEqual({
      status: 'unsupported',
      reason: 'optifine_requires_supported_version',
      warnings: ['optifine_requires_supported_version'],
    });
    expect(getModpackShaderCapabilityLabel(summary.shaderCapability.status, t)).toBe('Unsupported');
    expect(getModpackShaderCapabilityDescription(summary, t)).toContain(
      'OptiFine is only available for supported Minecraft versions.',
    );
  });

  it('marks config-backed runtimes without shader setup as needs-setup instead of pretending they are ready', () => {
    const config: ModpackConfig = {
      id: 'setup-pack',
      name: 'Setup Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: {
          type: 'forge',
          version: '47.2.0',
        },
      },
      game: {
        useOptiFine: false,
      },
    };

    const summary = buildModpackRuntimeSummary({
      config,
      optiFineVersions: ['1.20.1'],
    });

    expect(summary.status).toBe('healthy');
    expect(summary.requestedOptiFine).toBe(false);
    expect(summary.useOptiFine).toBe(false);
    expect(summary.shaderCapability).toEqual({
      status: 'needs-setup',
      reason: 'shader_runtime_not_configured',
      warnings: [],
    });
    expect(getModpackShaderCapabilityLabel(summary.shaderCapability.status, t)).toBe('Needs setup');
    expect(getModpackShaderCapabilityDescription(summary, t)).toContain('does not see shader support configured');
  });
});
