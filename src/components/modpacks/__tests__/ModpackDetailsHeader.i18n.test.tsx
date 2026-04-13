// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import type { ModpackConfig } from '../../../contexts/instances/types';
import type { ModpackMetadata } from '@shared/types/modpack';
import { ModpackDetailsHeader } from '../details/ModpackDetailsHeader';

const metadata: ModpackMetadata = {
  id: 'alpha',
  name: 'Alpha Pack',
  source: 'modrinth',
  minecraftVersion: '1.20.1',
  modLoader: {
    type: 'fabric',
    version: '0.15.11',
  },
  version: '2.4.0',
  author: 'FMCL Team',
  createdAt: '2026-04-13T00:00:00.000Z',
  updatedAt: '2026-04-13T00:00:00.000Z',
};

const effectiveConfig: ModpackConfig = {
  id: 'alpha',
  name: 'Alpha Pack',
  runtime: {
    minecraft: '1.20.1',
    modLoader: {
      type: 'fabric',
      version: '0.15.11',
    },
  },
};

function renderHeader(language: 'en' | 'ru') {
  const t = createTranslator(language);

  return render(
    <ModpackDetailsHeader
      modpackName="Alpha Pack"
      metadata={metadata}
      effectiveConfig={effectiveConfig}
      activeTab="info"
      onTabChange={vi.fn()}
      t={t}
      getAccentStyles={() => ({ className: '', style: undefined })}
      getAccentHex={() => '#10b981'}
    />
  );
}

describe('ModpackDetailsHeader i18n', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the refreshed details tabs with translated English copy', () => {
    const { container } = renderHeader('en');

    expect(screen.getByRole('tablist', { name: 'Modpack details' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Information' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Mods' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Resource packs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Shaders' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Worlds' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Screenshots' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeTruthy();

    expect(container.textContent).not.toContain('modpacks.details_title');
    expect(container.textContent).not.toContain('modpacks.tab_info');
    expect(container.textContent).not.toContain('modpacks.tab_screenshots');
  });

  it('renders the refreshed details tabs with translated Russian copy', () => {
    const { container } = renderHeader('ru');

    expect(screen.getByRole('tablist', { name: 'Детали модпака' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Информация' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Моды' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ресурспаки' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Шейдеры' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Миры' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Скриншоты' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Настройки' })).toBeTruthy();

    expect(container.textContent).not.toContain('modpacks.details_title');
    expect(container.textContent).not.toContain('modpacks.tab_info');
    expect(container.textContent).not.toContain('modpacks.tab_screenshots');
    expect(container.textContent).not.toContain('Modpack details');
    expect(container.textContent).not.toContain('Screenshots');
  });
});
