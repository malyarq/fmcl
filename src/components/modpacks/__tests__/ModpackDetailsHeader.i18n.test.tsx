// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { MEDIA_FALLBACK_PATH } from '../../../app/assets/branding';
import type { ModpackConfig } from '../../../contexts/instances/types';
import type { ModpackMetadata } from '@shared/types/modpack';
import { buildModpackRuntimeSummary } from '../../../features/modpacks/hooks/useModpackRuntimeSummary';
import { ModpackDetailsHeader, type ModpackDetailsTab } from '../details/ModpackDetailsHeader';

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
  const runtimeSummary = buildModpackRuntimeSummary({
    config: effectiveConfig,
    metadata,
  });

  return render(
    <ModpackDetailsHeader
      modpackName="Alpha Pack"
      metadata={metadata}
      runtimeSummary={runtimeSummary}
      activeTab="info"
      onTabChange={vi.fn()}
      t={t}
      getAccentStyles={() => ({ className: '', style: undefined })}
      getAccentHex={() => '#10b981'}
    />
  );
}

function renderInteractiveHeader(language: 'en' | 'ru') {
  const t = createTranslator(language);
  const runtimeSummary = buildModpackRuntimeSummary({
    config: effectiveConfig,
    metadata,
  });

  const Harness = () => {
    const [activeTab, setActiveTab] = React.useState<ModpackDetailsTab>('info');

    return (
      <ModpackDetailsHeader
        modpackName="Alpha Pack"
        metadata={metadata}
        runtimeSummary={runtimeSummary}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        t={t}
        getAccentStyles={() => ({ className: '', style: undefined })}
        getAccentHex={() => '#10b981'}
      />
    );
  };

  return render(<Harness />);
}

describe('ModpackDetailsHeader i18n', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders translated English tabs in a wrapped tab surface with keyboard navigation', async () => {
    const { container } = renderInteractiveHeader('en');
    const tablist = screen.getByRole('tablist', { name: 'Modpack details' });
    const infoTab = screen.getByRole('tab', { name: 'Information' });
    const modsTab = screen.getByRole('tab', { name: 'Mods' });
    const settingsTab = screen.getByRole('tab', { name: 'Settings' });

    expect(tablist).toBeTruthy();
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');
    expect(tablist.className).toContain('flex');
    expect(tablist.className).toContain('flex-wrap');
    expect(tablist.className).not.toContain('grid');
    expect(infoTab).toBeTruthy();
    expect(modsTab).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Resource packs' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Shaders' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Worlds' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Screenshots' })).toBeTruthy();
    expect(settingsTab).toBeTruthy();

    expect(infoTab.getAttribute('tabindex')).toBe('0');
    expect(modsTab.getAttribute('tabindex')).toBe('-1');
    expect(infoTab.getAttribute('data-state')).toBe('active');
    expect(modsTab.getAttribute('data-state')).toBe('inactive');

    infoTab.focus();
    fireEvent.keyDown(infoTab, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(document.activeElement).toBe(modsTab);
    });
    expect(modsTab.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(modsTab, { key: 'End' });

    await waitFor(() => {
      expect(document.activeElement).toBe(settingsTab);
    });
    expect(settingsTab.getAttribute('aria-selected')).toBe('true');

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

  it('uses the shared neutral fallback artwork when details header artwork is missing', async () => {
    renderHeader('en');

    await waitFor(() => {
      expect(screen.getByRole('img', { name: 'Alpha Pack' }).getAttribute('src')).toBe(MEDIA_FALLBACK_PATH);
    });
  });
});
