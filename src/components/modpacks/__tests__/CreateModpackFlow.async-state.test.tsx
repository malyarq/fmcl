// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackCreationWizard } from '../ModpackCreationWizard';

const refreshMock = vi.fn();
const createMock = vi.fn();
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

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
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

vi.mock('../../../services/ipc/instancesIPC', () => ({
  instancesIPC: {
    create: (...args: unknown[]) => createMock(...args),
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

describe('ModpackCreationWizard async state', () => {
  beforeEach(() => {
    mockMatchMedia();
    localStorage.clear();
    refreshMock.mockReset();
    createMock.mockReset();
    getModsMock.mockReset();

    refreshMock.mockResolvedValue(undefined);
    createMock.mockResolvedValue({ ok: true, value: { status: 'committed', selectedId: 'pack-1', instances: [] } });
    getModsMock.mockResolvedValue([]);
  });

  it('locks every obvious exit while the durable create is running', async () => {
    const deferred = createDeferred<{ ok: true; value: { status: 'committed'; selectedId: string; instances: [] } }>();
    createMock.mockReturnValue(deferred.promise);

    render(<ModpackCreationWizard onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Busy Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByRole('button', { name: 'Modpacks' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /^Back$/ })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Next' }).getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      deferred.resolve({ ok: true, value: { status: 'committed', selectedId: 'pack-1', instances: [] } });
      await deferred.promise;
    });
  });

  it('keeps refresh failure after a committed create as calm optional follow-up', async () => {
    const onCreated = vi.fn();
    refreshMock.mockRejectedValue(new Error('refresh failed'));

    render(<ModpackCreationWizard onBack={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Recovery Pack' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Needs recovery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByTestId('modpack-creation-recovery')).toBeTruthy();
    });

    const followUpNotice = screen.getByTestId('modpack-creation-recovery');
    expect(followUpNotice.textContent).toContain('Created successfully.');
    expect(followUpNotice.textContent).toContain('optional details can be updated later');
    expect(followUpNotice.getAttribute('role')).toBe('status');
    expect(screen.queryByText('Error creating modpack')).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    expect(refreshMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith({
      name: 'Recovery Pack',
      source: {
        source: 'local',
        version: '1.0.0',
        description: 'Needs recovery',
      },
      config: {
        runtime: {
          minecraftVersion: '1.20.1',
          modLoader: { type: 'vanilla' },
        },
      },
    });

    refreshMock.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('pack-1');
    });
  });
});
