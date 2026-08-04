// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackCreationWizard } from '../ModpackCreationWizard';

const createMock = vi.fn();
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

vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({
    invalidateInstance: vi.fn(),
    invalidateInstances: refreshMock,
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

vi.mock('../../../services/ipc/instancesIPC', () => ({
  instancesIPC: { create: (...args: unknown[]) => createMock(...args) },
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

describe('Create wizard dependency truth', () => {
  beforeEach(() => {
    currentLanguage = 'en';
    mockMatchMedia();
    localStorage.clear();
    createMock.mockReset();
    refreshMock.mockReset();
    createMock.mockResolvedValue({ ok: true, value: { status: 'committed', selectedId: 'pack-1', instances: [] } });
    refreshMock.mockResolvedValue(undefined);
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
