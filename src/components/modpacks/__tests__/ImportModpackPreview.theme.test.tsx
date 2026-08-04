// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportModpackPreviewModal } from '../ImportModpackPreviewModal';
import { ImportModpackPreviewPage } from '../ImportModpackPreviewPage';
import { InstallModpackModal } from '../InstallModpackModal';
import type { ModpackManifest } from '@shared/types/modpack';
import type { ProviderCatalogSearchResultItem, ProviderCatalogVersionDescriptor } from '@shared/contracts';

const refreshMock = vi.fn();

const translations: Record<string, string> = {
  'modpacks.import_preview': 'Import Preview',
  'modpacks.loading': 'Loading...',
  'modpacks.version': 'Version',
  'modpacks.minecraft_version': 'Minecraft Version',
  'modpacks.loader': 'Loader',
  'modpacks.author': 'Author',
  'modpacks.mods_count': 'Mods',
  'modpacks.mods': 'mods',
  'modpacks.format': 'Format',
  'modpacks.platform_curseforge': 'CurseForge',
  'modpacks.platform_modrinth': 'Modrinth',
  'modpacks.import': 'Import',
  'modpacks.unable_to_load_info': 'Unable to load modpack info',
  'modpacks.select_version': 'Select Version',
  'modpacks.install': 'Install',
  'modpacks.install_success': 'Install completed',
  'general.cancel': 'Cancel',
  'general.back': 'Back',
};

function t(key: string) {
  return translations[key] ?? key;
}

function getAccentStyles(type: string) {
  if (type === 'bg') {
    return { className: 'accent-bg', style: undefined };
  }

  return { className: '', style: undefined };
}

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t,
    getAccentStyles,
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat('en-US', options).format(value),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ModpackContext', () => ({
  useModpackListContext: () => ({
    refresh: refreshMock,
  }),
}));

const manifest: ModpackManifest = {
  formatVersion: 1,
  minecraft: {
    version: '1.20.1',
    modLoaders: [{ id: 'fabric-0.15.0', primary: true }],
  },
  name: 'Alpha Pack',
  version: '1.0.0',
  author: 'FriendLauncher',
  files: [{ projectID: 1, fileID: 2, required: true }],
};
const inspection = { format: 'modrinth' as const, manifest };

const modpack: ProviderCatalogSearchResultItem = {
  platform: 'modrinth',
  projectId: 'alpha-pack',
  title: 'Alpha Pack',
  description: 'A contrast-safe modpack surface.',
  iconUrl: 'https://example.test/icon.png',
};

const versions: ProviderCatalogVersionDescriptor[] = [
  {
    platform: 'modrinth',
    versionId: 'version-1',
    name: 'Release 1',
    mcVersions: ['1.20.1'],
    loaders: ['fabric'],
    files: [],
  },
];

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

describe('Modpack import theme seams', () => {
  beforeEach(() => {
    refreshMock.mockReset();

    mockMatchMedia();
  });

  it('renders the preview modal with semantic metadata surfaces and accent-content actions', async () => {
    render(
      <ImportModpackPreviewModal
        archiveRef="archive-ref"
        inspection={inspection}
        isOpen
        onClose={vi.fn()}
        onImport={vi.fn()}
      />,
    );

    expect(await screen.findByText('Alpha Pack')).toBeTruthy();
    expect(screen.getByText('Alpha Pack').closest('.surface-soft')).toBeTruthy();
    expect(screen.getByText('Version').className).toContain('helper-text');
    expect(screen.getByRole('button', { name: 'Import' }).className).toContain('text-[rgb(var(--accent-content))]');
  });

  it('renders the full preview page with semantic header and readable metadata card', async () => {
    render(<ImportModpackPreviewPage archiveRef="archive-ref" inspection={inspection} onBack={vi.fn()} />);

    expect(await screen.findByText('Alpha Pack')).toBeTruthy();

    const heading = screen.getByRole('heading', { name: 'Import Preview' });
    expect(heading.closest('div')?.className).toContain('bg-card/78');
    expect(screen.getByText('Alpha Pack').closest('.surface-soft')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import' }).className).toContain('text-[rgb(var(--accent-content))]');
  });

  it('renders the install modal with semantic cards and the shared secondary action styling', () => {
    render(
      <InstallModpackModal
        isOpen
        onClose={vi.fn()}
        modpack={modpack}
        versions={versions}
        platform="modrinth"
      />,
    );

    expect(screen.getByText('Alpha Pack').closest('.surface-soft')).toBeTruthy();
    expect(screen.getByText('Minecraft Version').closest('.surface-soft')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('bg-card/82');
    expect(screen.getByRole('button', { name: 'Install' }).className).toContain('text-[rgb(var(--accent-content))]');
  });
});
