// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackCreationWizard } from '../ModpackCreationWizard';

const refreshMock = vi.fn();
const createLocalMock = vi.fn();
const updateMetadataMock = vi.fn();
const getModsMock = vi.fn();

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
    t: createTranslator('en'),
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
    getMods: (...args: unknown[]) => getModsMock(...args),
    removeMod: vi.fn(),
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
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
    fabricVersions: ['1.20.1'],
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

describe('ModpackCreationWizard explainability', () => {
  beforeEach(() => {
    mockMatchMedia();
    localStorage.clear();
    refreshMock.mockReset();
    createLocalMock.mockReset();
    updateMetadataMock.mockReset();
    getModsMock.mockReset();

    refreshMock.mockResolvedValue(undefined);
    updateMetadataMock.mockResolvedValue(undefined);
    getModsMock.mockResolvedValue([]);
  });

  it('turns runtime warnings into explicit next-step guidance before and after a failed create attempt', async () => {
    createLocalMock.mockRejectedValue(new Error('blocked by runtime'));

    render(<ModpackCreationWizard onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Warning Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enable OptiFine' }));
    fireEvent.change(screen.getByLabelText('Minecraft Version'), { target: { value: '1.19.4' } });

    expect(screen.getByText('OptiFine is only available for supported Minecraft versions.')).toBeTruthy();
    expect(
      screen.getByText('Choose a Minecraft version with OptiFine support or turn off OptiFine in this draft.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('FMCL still sees a runtime issue in this draft');
    });

    expect(screen.getByRole('alert').textContent).toContain('OptiFine is only available for supported Minecraft versions.');
    expect(screen.getByRole('alert').textContent).toContain(
      'Choose a Minecraft version with OptiFine support or turn off OptiFine in this draft.',
    );
    expect(screen.queryByText('Error creating modpack')).toBeNull();
  });

  it('keeps the generic create error as the fallback when the runtime summary has no actionable cause', async () => {
    createLocalMock.mockRejectedValue(new Error('unknown create failure'));

    render(<ModpackCreationWizard onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Fallback Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Error creating modpack');
    });

    expect(screen.queryByText(/FMCL still sees a runtime issue in this draft/)).toBeNull();
  });

  it('separates optional follow-up guidance from the successful create boundary', async () => {
    createLocalMock.mockResolvedValue({ id: 'pack-1' });
    updateMetadataMock.mockRejectedValue(new Error('metadata failed'));

    render(<ModpackCreationWizard onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Calm Pack' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Optional metadata' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const followUpNotice = await screen.findByTestId('modpack-creation-recovery');
    expect(followUpNotice.textContent).toContain('Created successfully.');
    expect(followUpNotice.textContent).not.toMatch(/failed|error/i);
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
  });
});
