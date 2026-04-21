// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { CreateModpackModal } from '../CreateModpackModal';
import { ModpackCreationWizard } from '../ModpackCreationWizard';

const createLocalMock = vi.fn();
const updateMetadataMock = vi.fn();
const getConfigMock = vi.fn();
const saveConfigMock = vi.fn();
const refreshMock = vi.fn();

let currentLanguage: 'en' | 'ru' = 'en';

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
    t: createTranslator(currentLanguage),
    getAccentStyles: () => ({ className: '', style: undefined }),
    minecraftPath: '/minecraft',
  }),
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpack: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    createLocal: (...args: unknown[]) => createLocalMock(...args),
    updateMetadata: (...args: unknown[]) => updateMetadataMock(...args),
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    saveConfig: (...args: unknown[]) => saveConfigMock(...args),
    getMods: vi.fn().mockResolvedValue([]),
    removeMod: vi.fn(),
  },
}));

vi.mock('../../../features/launcher/hooks/useVersions', () => ({
  useVersions: () => ({
    versions: [
      { id: '1.20.1', type: 'release' },
      { id: '1.19.4', type: 'release' },
    ],
  }),
}));

vi.mock('../../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: ['1.20.1'],
    fabricVersions: ['1.20.1', '1.19.4'],
    neoForgeVersions: ['1.20.1'],
    optiFineVersions: ['1.20.1'],
  }),
}));

vi.mock('../AddModModal', () => ({
  AddModModal: () => null,
}));

vi.mock('../details', () => ({
  ModpackDetailsModsTab: () => <div>Mods step</div>,
}));

describe('Create-modpack dependency truth', () => {
  beforeEach(() => {
    currentLanguage = 'en';
    mockMatchMedia();
    localStorage.clear();
    createLocalMock.mockReset();
    updateMetadataMock.mockReset();
    getConfigMock.mockReset();
    saveConfigMock.mockReset();
    refreshMock.mockReset();
    createLocalMock.mockResolvedValue({ id: 'pack-1' });
    updateMetadataMock.mockResolvedValue(undefined);
    getConfigMock.mockResolvedValue({
      id: 'pack-1',
      name: 'Alpha Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: { type: 'forge' },
      },
      game: {},
    });
    saveConfigMock.mockResolvedValue({ ok: true });
    refreshMock.mockResolvedValue(undefined);
  });

  it('keeps modal summary aligned with the dependency data persisted on create', async () => {
    render(
      <CreateModpackModal
        isOpen
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Alpha Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Forge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable OptiFine' }));

    const summary = screen.getByTestId('modpack-dependency-summary');
    const summaryQueries = within(summary);
    expect(summary).toBeTruthy();
    expect(summaryQueries.getByText('Runtime dependencies')).toBeTruthy();
    expect(screen.getByTestId('modpack-dependency-count').textContent).toBe('3');
    expect(screen.getByTestId('modpack-dependency-status').getAttribute('data-tone')).toBe('healthy');
    expect(summaryQueries.getByText('Minecraft Version')).toBeTruthy();
    expect(summaryQueries.getByText('1.20.1')).toBeTruthy();
    expect(summaryQueries.getByText('Forge')).toBeTruthy();
    expect(summaryQueries.getByText('Modloader Version')).toBeTruthy();
    expect(summaryQueries.getByText('Unverified')).toBeTruthy();
    expect(summaryQueries.getByText('OptiFine')).toBeTruthy();
    expect(screen.queryByTestId('modpack-dependency-warnings')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(createLocalMock).toHaveBeenCalledWith(
        'Alpha Pack',
        '1.0.0',
        '1.20.1',
        { type: 'forge', version: undefined },
        '/minecraft',
      );
    });
    expect(getConfigMock).toHaveBeenCalledWith('pack-1', '/minecraft');
    expect(saveConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({
        game: expect.objectContaining({ useOptiFine: true }),
      }),
      '/minecraft',
    );
  });

  it('shows the wizard step-two summary with the same selected runtime dependency truth', () => {
    render(
      <ModpackCreationWizard
        onBack={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Beta Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'NeoForge' }));

    const summary = screen.getByTestId('modpack-dependency-summary');
    const summaryQueries = within(summary);
    expect(summaryQueries.getByText('Runtime dependencies')).toBeTruthy();
    expect(screen.getByTestId('modpack-dependency-count').textContent).toBe('2');
    expect(screen.getByTestId('modpack-dependency-status').getAttribute('data-tone')).toBe('healthy');
    expect(summaryQueries.getByText('Minecraft Version')).toBeTruthy();
    expect(summaryQueries.getByText('1.20.1')).toBeTruthy();
    expect(summaryQueries.getByText('NeoForge')).toBeTruthy();
    expect(summaryQueries.getByText('Modloader Version')).toBeTruthy();
    expect(summaryQueries.getByText('Unverified')).toBeTruthy();
  });
});
