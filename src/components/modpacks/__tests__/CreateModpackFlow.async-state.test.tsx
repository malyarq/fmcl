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
    create: (...args: unknown[]) => createMock(...args),
  },
}));

vi.mock('../../../services/ipc/instanceModsIPC', () => ({
  instanceModsIPC: {
    list: (...args: unknown[]) => getModsMock(...args),
    remove: vi.fn(),
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

  it('restores a valid user draft without rewriting it on mount and discards it only on request', () => {
    const storedDraft = JSON.stringify({
      name: 'Restored Pack',
      description: 'Keep my work',
      version: '2.0.0',
      minecraftVersion: '1.19.4',
      useForge: false,
      useFabric: true,
      useNeoForge: false,
      useOptiFine: false,
    });
    localStorage.setItem('modpack_creation_draft', storedDraft);

    render(<ModpackCreationWizard onBack={vi.fn()} />);

    expect(screen.getByLabelText('Modpack name')).toHaveProperty('value', 'Restored Pack');
    expect(screen.getByLabelText('Description')).toHaveProperty('value', 'Keep my work');
    expect(screen.getByTestId('modpack-creation-draft-restored').textContent).toContain('Draft restored');
    expect(localStorage.getItem('modpack_creation_draft')).toBe(storedDraft);

    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));

    expect(screen.getByLabelText('Modpack name')).toHaveProperty('value', '');
    expect(localStorage.getItem('modpack_creation_draft')).toBeNull();
  });

  it('keeps a corrupt stored draft untouched until explicit recovery', () => {
    const corruptDraft = '{"name":42,"useFabric":"yes"}';
    localStorage.setItem('modpack_creation_draft', corruptDraft);

    render(<ModpackCreationWizard onBack={vi.fn()} />);

    expect(screen.getByTestId('modpack-creation-draft-recovery').getAttribute('role')).toBe('alert');
    expect(screen.getByText('Saved draft cannot be restored')).toBeTruthy();
    expect(screen.queryByLabelText('Modpack name')).toBeNull();
    expect(localStorage.getItem('modpack_creation_draft')).toBe(corruptDraft);

    fireEvent.click(screen.getByRole('button', { name: 'Discard invalid draft' }));

    expect(screen.getByLabelText('Modpack name')).toHaveProperty('value', '');
    expect(localStorage.getItem('modpack_creation_draft')).toBeNull();
  });

  it('coalesces duplicate create submissions onto one canonical command', async () => {
    const deferred = createDeferred<{ ok: true; value: { status: 'committed'; selectedId: string; instances: [] } }>();
    createMock.mockReturnValue(deferred.promise);

    render(<ModpackCreationWizard onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'One Pack' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const submit = screen.getByRole('button', { name: 'Next' });
    submit.click();
    submit.click();

    expect(createMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferred.resolve({ ok: true, value: { status: 'committed', selectedId: 'pack-1', instances: [] } });
      await deferred.promise;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    });
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /^Back$/ })).toBeNull();
  });

  it('finishes a committed create at most once under duplicate activation', async () => {
    const onCreated = vi.fn();
    render(<ModpackCreationWizard onBack={vi.fn()} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Finish Once' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const finish = await screen.findByRole('button', { name: 'Finish' });
    finish.click();
    finish.click();

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    expect(onCreated).toHaveBeenCalledWith('pack-1');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('keeps post-create content read failures visible and retryable on the current step', async () => {
    getModsMock.mockRejectedValueOnce(new Error('manifest unavailable')).mockResolvedValueOnce([]);
    render(<ModpackCreationWizard onBack={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Modpack name'), { target: { value: 'Visible Recovery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    const recovery = await screen.findByTestId('modpack-creation-content-load-error');
    expect(recovery.getAttribute('role')).toBe('alert');
    expect(recovery.textContent).toContain('manifest unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Mods step')).toBeTruthy();
    });
    expect(getModsMock).toHaveBeenCalledTimes(2);
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
