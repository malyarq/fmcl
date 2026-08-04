// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import type { ModpackMetadata } from '@shared/types/modpack';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackDetails } from '../ModpackDetails';

const t = createTranslator('en');
const fetchMetadataMock = vi.fn();
const resolveUpdateMock = vi.fn();
const loadModpackConfigMock = vi.fn();
const refreshMock = vi.fn();
const selectMock = vi.fn();
const navigateMock = vi.fn();
const updateMetadataMock = vi.fn();

const metadata: ModpackMetadata = {
  id: 'keyboard-pack',
  name: 'Keyboard Pack',
  version: '1.0.0',
  minecraftVersion: '1.20.1',
  modLoader: { type: 'forge', version: '47.2.0' },
  source: 'local',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
  description: 'A keyboard-owned details route.',
};

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
  }),
}));

vi.mock('../../../features/instances/hooks/useInstanceSelectors', () => ({
  useInstanceList: () => ({
    status: 'ready',
    data: [{ id: 'keyboard-pack', name: 'Keyboard Pack' }],
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
  useToast: () => ({ error: vi.fn() }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({ confirm: vi.fn(), prompt: vi.fn() }),
}));

vi.mock('../../../features/modpacks/hooks/useModpackDetailsConfig', () => ({
  useModpackDetailsConfig: () => ({
    effectiveConfig: {
      id: 'keyboard-pack',
      name: 'Keyboard Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: { type: 'forge', version: '47.2.0' },
      },
    },
    loadModpackConfig: loadModpackConfigMock,
    setters: {},
  }),
}));

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn().mockResolvedValue(undefined),
    invalidateInstances: (...args: unknown[]) => refreshMock(...args),
  }),
}));

vi.mock('../../../features/launcher/hooks/useVersions', () => ({
  useVersions: () => ({ versions: [] }),
}));

vi.mock('../../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: [],
    fabricVersions: [],
    neoForgeVersions: [],
    optiFineVersions: [],
  }),
}));

vi.mock('../../../contexts/instances/services/instancesService', () => ({
  fetchModpackMetadata: (...args: unknown[]) => fetchMetadataMock(...args),
  updateModpackMetadata: (...args: unknown[]) => updateMetadataMock(...args),
}));

vi.mock('../../../features/modpacks/hooks/useModpackUpdates', () => ({
  resolveModpackUpdateInfo: (...args: unknown[]) => resolveUpdateMock(...args),
}));

describe('ModpackDetails keyboard, loading and ownership contract', () => {
  beforeEach(() => {
    fetchMetadataMock.mockReset();
    resolveUpdateMock.mockReset();
    loadModpackConfigMock.mockReset().mockResolvedValue(undefined);
    refreshMock.mockReset().mockResolvedValue(undefined);
    selectMock.mockReset().mockResolvedValue(undefined);
    navigateMock.mockReset();
    updateMetadataMock.mockReset().mockResolvedValue(undefined);
    resolveUpdateMock.mockResolvedValue(null);
  });

  it('keeps an explicit loading state and a keyboard-retryable metadata error', async () => {
    let rejectLoad: ((reason?: unknown) => void) | undefined;
    fetchMetadataMock
      .mockImplementationOnce(() => new Promise<ModpackMetadata>((_resolve, reject) => {
        rejectLoad = reject;
      }))
      .mockResolvedValueOnce(metadata);

    render(
      <StrictMode>
        <ModpackDetails
          modpackId="keyboard-pack"
          onBack={vi.fn()}
          onNavigate={navigateMock}
        />
      </StrictMode>,
    );

    expect(screen.getByTestId('modpack-details-loading').getAttribute('role')).toBe('status');
    await waitFor(() => {
      expect(fetchMetadataMock).toHaveBeenCalledTimes(1);
    });
    rejectLoad?.(new Error('metadata offline'));

    const error = await screen.findByTestId('modpack-details-load-error');
    expect(error.getAttribute('role')).toBe('alert');
    const retry = screen.getByRole('button', { name: 'Retry details' });
    retry.focus();
    expect(document.activeElement).toBe(retry);
    fireEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByTestId('modpack-details-overview')).toBeTruthy();
    });
    expect(fetchMetadataMock).toHaveBeenCalledTimes(2);
  });

  it('keeps roving tab focus and routes Add Mod with only the opaque instance id', async () => {
    render(
      <div style={{ width: 720 }}>
        <ModpackDetails
          modpackId="keyboard-pack"
          onBack={vi.fn()}
          onNavigate={navigateMock}
          hydrateFromIpc={false}
          initialMetadata={metadata}
        />
      </div>,
    );

    expect(screen.getByTestId('modpack-details-overview').getAttribute('data-details-owner')).toBe('overview');
    expect(screen.getByTestId('modpack-details-action-bar').getAttribute('data-details-owner')).toBe('actions');

    const infoTab = screen.getByRole('tab', { name: 'Information' });
    fireEvent.keyDown(infoTab, { key: 'ArrowRight' });

    const modsTab = screen.getByRole('tab', { name: 'Mods' });
    await waitFor(() => {
      expect(modsTab.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(modsTab);
    });

    fireEvent.click(screen.getByRole('button', { name: '+ Add Mod' }));
    expect(navigateMock).toHaveBeenCalledWith({ type: 'addMod', modpackId: 'keyboard-pack' });
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
  });

  it('keeps update-check failure non-blocking and retries it without hiding Play', async () => {
    fetchMetadataMock.mockResolvedValue(metadata);
    resolveUpdateMock
      .mockRejectedValueOnce(new Error('catalog offline'))
      .mockResolvedValueOnce(null);

    render(
      <ModpackDetails
        modpackId="keyboard-pack"
        onBack={vi.fn()}
        onNavigate={navigateMock}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Play' })).toBeTruthy();
    expect(await screen.findByText('Update status is unavailable. Launching remains available.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry update check' }));

    await waitFor(() => {
      expect(screen.queryByText('Update status is unavailable. Launching remains available.')).toBeNull();
    });
    expect(resolveUpdateMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('invalidates only the current canonical snapshot after description save', async () => {
    fetchMetadataMock.mockResolvedValue({ ...metadata, description: 'Updated description' });

    render(
      <ModpackDetails
        modpackId="keyboard-pack"
        onBack={vi.fn()}
        onNavigate={navigateMock}
        hydrateFromIpc={false}
        initialMetadata={metadata}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Briefly describe the modpack (optional)'), {
      target: { value: ' Updated description ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateMetadataMock).toHaveBeenCalledWith('keyboard-pack', {
        description: 'Updated description',
      });
    });
    await waitFor(() => {
      expect(loadModpackConfigMock).toHaveBeenCalledTimes(2);
    });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
