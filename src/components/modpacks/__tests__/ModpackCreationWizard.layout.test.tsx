// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
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
  instancesIPC: {
    create: vi.fn().mockResolvedValue({ ok: true, value: { status: 'committed', selectedId: 'pack-1', instances: [] } }),
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

  it('keeps draft, canonical create, runtime and content ownership in focused modules', async () => {
    const [wizardSource, draftSource, runtimeSource, contentSource] = await Promise.all([
      readFile(`${process.cwd()}/src/components/modpacks/ModpackCreationWizard.tsx`, 'utf8'),
      readFile(`${process.cwd()}/src/features/modpacks/hooks/useModpackCreationDraft.ts`, 'utf8'),
      readFile(`${process.cwd()}/src/components/modpacks/create/CreationRuntimeStep.tsx`, 'utf8'),
      readFile(`${process.cwd()}/src/components/modpacks/create/CreationContentStep.tsx`, 'utf8'),
    ]);

    expect(wizardSource).not.toMatch(/localStorage|instancesIPC|instanceModsIPC|AddModModal/);
    expect(wizardSource).toMatch(/useModpackCreationDraft/);
    expect(draftSource).toMatch(/localStorage/);
    expect(draftSource).toMatch(/instancesIPC\.create/);
    expect(runtimeSource).toMatch(/ModloaderSection/);
    expect(contentSource).toMatch(/AddModModal/);
    expect(contentSource).toMatch(/instanceModsIPC\.(list|remove)/);
    expect(contentSource).not.toMatch(/defaultMCVersion|defaultLoader/);
  });

  it('keeps the wizard action block inside the main content flow as a card section', () => {
    render(<ModpackCreationWizard onBack={vi.fn()} />);

    const flow = screen.getByTestId('modpack-creation-flow');
    const scrollRegion = screen.getByTestId('modpack-creation-scroll-region');
    const actionRail = screen.getByTestId('modpack-creation-action-rail');
    const actions = screen.getByTestId('modpack-creation-actions');

    expect(flow.contains(actions)).toBe(true);
    expect(scrollRegion.contains(actions)).toBe(false);
    expect(actionRail.contains(actions)).toBe(true);
    expect(flow.className).toContain('min-h-0');
    expect(scrollRegion.className).toContain('overflow-y-auto');
    expect(actions.className).toContain('surface-card');
    expect(actionRail.className).toContain('border-t');
    expect(screen.getByRole('button', { name: 'Next' }).className).toContain('w-full');

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Layout Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(scrollRegion.contains(screen.getByTestId('modpack-dependency-summary'))).toBe(true);
    expect(screen.getByTestId('modpack-dependency-count').textContent).toBe('1');
  });
});
