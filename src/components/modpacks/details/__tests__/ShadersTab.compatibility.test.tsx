// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import type { ModpackConfig } from '../../../../contexts/instances/types';
import { buildModpackRuntimeSummary } from '../../../../features/modpacks/hooks/useModpackRuntimeSummary';
import { ShadersTab } from '../ShadersTab';

const listMock = vi.fn();
const t = createTranslator('en');

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
  }),
}));

vi.mock('../../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../../services/ipc/shadersIPC', () => ({
  shadersIPC: {
    list: (...args: unknown[]) => listMock(...args),
    setActive: vi.fn(),
    disable: vi.fn(),
    delete: vi.fn(),
  },
}));

function buildConfig(overrides: Partial<ModpackConfig> = {}): ModpackConfig {
  return {
    id: 'alpha',
    name: 'Alpha Pack',
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
    ...overrides,
  };
}

describe('ShadersTab compatibility guidance', () => {
  beforeEach(() => {
    cleanup();
    listMock.mockReset();
    listMock.mockResolvedValue([]);
  });

  it('shows supported guidance without claiming every shader pack will work', async () => {
    const runtimeSummary = buildModpackRuntimeSummary({
      config: buildConfig({
        game: {
          useOptiFine: true,
        },
      }),
      optiFineVersions: ['1.20.1'],
    });

    render(<ShadersTab instanceId="alpha" runtimeSummary={runtimeSummary} />);

    expect(await screen.findByText('No shader packs installed')).toBeTruthy();

    const guidance = screen.getByTestId('shader-capability-summary');
    expect(guidance.getAttribute('data-status')).toBe('supported');
    expect(guidance.textContent).toContain('Supported');
    expect(guidance.textContent).toContain('Individual shader packs can still be incompatible');
    expect(guidance.textContent?.toLowerCase()).not.toContain('guaranteed');
  });

  it('shows needs-setup guidance when runtime truth is known but shader support is not configured', async () => {
    const runtimeSummary = buildModpackRuntimeSummary({
      config: buildConfig(),
      optiFineVersions: ['1.20.1'],
    });

    render(<ShadersTab instanceId="alpha" runtimeSummary={runtimeSummary} />);

    expect(await screen.findByText('No shader packs installed')).toBeTruthy();

    const guidance = screen.getByTestId('shader-capability-summary');
    expect(guidance.getAttribute('data-status')).toBe('needs-setup');
    expect(guidance.textContent).toContain('Needs setup');
    expect(guidance.textContent).toContain('does not see shader support configured');
    expect(guidance.textContent).not.toContain('Supported');
  });

  it('shows unsupported guidance when the configured shader runtime conflicts with the pack runtime', async () => {
    const runtimeSummary = buildModpackRuntimeSummary({
      config: buildConfig({
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
      }),
      optiFineVersions: ['1.20.1'],
    });

    render(<ShadersTab instanceId="alpha" runtimeSummary={runtimeSummary} />);

    expect(await screen.findByText('No shader packs installed')).toBeTruthy();

    const guidance = screen.getByTestId('shader-capability-summary');
    expect(guidance.getAttribute('data-status')).toBe('unsupported');
    expect(guidance.textContent).toContain('Unsupported');
    expect(guidance.textContent).toContain('OptiFine is only available for supported Minecraft versions.');
    expect(guidance.textContent).not.toContain('Needs setup');
  });

  it('shows unverified guidance when runtime truth only comes from metadata', async () => {
    const runtimeSummary = buildModpackRuntimeSummary({
      metadata: {
        id: 'alpha',
        name: 'Alpha Pack',
        source: 'modrinth',
        minecraftVersion: '1.20.1',
        modLoader: {
          type: 'fabric',
        },
        createdAt: '2026-04-21T00:00:00.000Z',
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
    });

    render(<ShadersTab instanceId="alpha" runtimeSummary={runtimeSummary} />);

    expect(await screen.findByText('No shader packs installed')).toBeTruthy();

    const guidance = screen.getByTestId('shader-capability-summary');
    expect(guidance.getAttribute('data-status')).toBe('unverified');
    expect(guidance.textContent).toContain('Unverified');
    expect(guidance.textContent).toContain('metadata');
    expect(guidance.textContent).not.toContain('Supported');
  });
});
