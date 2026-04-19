// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackCreationWizard } from '../ModpackCreationWizard';

const refreshMock = vi.fn();

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
    createLocal: vi.fn().mockResolvedValue({ id: 'pack-1' }),
    updateMetadata: vi.fn().mockResolvedValue(undefined),
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

describe('ModpackCreationWizard flow layout', () => {
  beforeEach(() => {
    mockMatchMedia();
    localStorage.clear();
    refreshMock.mockReset();
    refreshMock.mockResolvedValue(undefined);
  });

  it('keeps the wizard action block inside the main content flow as a card section', () => {
    render(<ModpackCreationWizard onBack={vi.fn()} />);

    const flow = screen.getByTestId('modpack-creation-flow');
    const actions = screen.getByTestId('modpack-creation-actions');

    expect(flow.contains(actions)).toBe(true);
    expect(actions.className).toContain('surface-card');
    expect(actions.className).not.toContain('sticky');
    expect(screen.getByRole('button', { name: 'Next' }).className).toContain('w-full');

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Layout Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(flow.contains(screen.getByTestId('modpack-dependency-summary'))).toBe(true);
    expect(screen.getByTestId('modpack-dependency-count').textContent).toBe('1');
  });
});
