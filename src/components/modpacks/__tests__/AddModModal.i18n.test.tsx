// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { AddModModal } from '../AddModModal';

const searchModsMock = vi.fn();
const getMetadataMock = vi.fn();
const getConfigMock = vi.fn();

type Language = 'en' | 'ru';

let currentLanguage: Language = 'en';

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

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../../services/ipc/modsIPC', () => ({
  modsIPC: {
    searchMods: (...args: unknown[]) => searchModsMock(...args),
    getModVersions: vi.fn(),
    installModFile: vi.fn(),
  },
}));

vi.mock('../../../services/ipc/modpacksIPC', () => ({
  modpacksIPC: {
    getMetadata: (...args: unknown[]) => getMetadataMock(...args),
    getConfig: (...args: unknown[]) => getConfigMock(...args),
    addMod: vi.fn(),
  },
}));

describe('AddModModal i18n seams', () => {
  beforeEach(() => {
    cleanup();
    mockMatchMedia();
    currentLanguage = 'en';
    searchModsMock.mockReset();
    getMetadataMock.mockReset();
    getConfigMock.mockReset();

    searchModsMock.mockResolvedValue({ items: [], total: 0 });
    getMetadataMock.mockResolvedValue({
      id: 'alpha',
      name: 'Alpha Pack',
      source: 'local',
      minecraftVersion: '1.20.1',
      modLoader: { type: 'fabric' },
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-13T00:00:00.000Z',
    });
    getConfigMock.mockResolvedValue({
      id: 'alpha',
      name: 'Alpha Pack',
      runtime: {
        minecraft: '1.20.1',
        modLoader: { type: 'fabric' },
      },
    });
  });

  it('renders the add-mod modal with translated English route copy and platform status text', async () => {
    const { container } = render(
      <AddModModal
        modpackId="alpha"
        isOpen
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByRole('dialog', { name: /Add mods/ })).toBeTruthy();

    expect(screen.getByRole('button', { name: 'CurseForge (Soon)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Modrinth' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Search mods...')).toBeTruthy();

    await waitFor(() => {
      expect(searchModsMock).toHaveBeenCalled();
    });

    expect(container.textContent).not.toContain('modpacks.add_mod_title');
    expect(container.textContent).not.toContain('modpacks.coming_soon_short');
    expect(container.textContent).not.toContain('(WIP)');
  });

  it('renders the add-mod modal with translated Russian copy and no English fallback labels', async () => {
    currentLanguage = 'ru';

    const { container } = render(
      <AddModModal
        modpackId="alpha"
        isOpen
        onClose={vi.fn()}
      />
    );

    expect(await screen.findByRole('dialog', { name: /Добавить моды/ })).toBeTruthy();

    expect(screen.getByRole('button', { name: 'CurseForge (Скоро)' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Поиск модов...')).toBeTruthy();

    expect(container.textContent).not.toContain('modpacks.add_mod_title');
    expect(container.textContent).not.toContain('modpacks.coming_soon_short');
    expect(container.textContent).not.toContain('Add mods');
    expect(container.textContent).not.toContain('Soon');
  });
});
