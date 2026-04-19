// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackDetailsActions } from '../details/ModpackDetailsActions';
import { ModpackDetailsModsTab } from '../details/ModpackDetailsModsTab';

const t = createTranslator('en');

function hasClassFragment(container: HTMLElement, fragment: string): boolean {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).some(
    (element) => typeof element.className === 'string' && element.className.includes(fragment),
  );
}

describe('Modpack details flow layout', () => {
  it('renders route actions as a card-based flow section instead of an inline footer strip', () => {
    render(
      <ModpackDetailsActions
        onLaunch={vi.fn()}
        hasUpdate={false}
        onShowUpdate={vi.fn()}
        onRename={vi.fn()}
        onDuplicate={vi.fn()}
        onExport={vi.fn()}
        canDelete
        onDelete={vi.fn()}
        t={t}
        getAccentStyles={() => ({ className: '', style: undefined })}
      />,
    );

    const playButton = screen.getByRole('button', { name: 'Play' });
    const actionsSection = playButton.closest('section');

    expect(actionsSection).toBeTruthy();
    expect(actionsSection?.className).toContain('surface-card');
    expect(actionsSection?.className).not.toContain('surface-inline mx-6');
  });

  it('keeps the mods list in the page flow without the old fixed-height internal scroller', () => {
    const { container } = render(
      <ModpackDetailsModsTab
        mods={[
          {
            id: 'alpha',
            name: 'Alpha Mod',
            version: '1.0.0',
            hash: { sha1: 'alpha-hash' },
            file: { name: 'alpha.jar', path: '/mods/alpha.jar', size: 128, mtimeMs: 1 },
            deps: [],
            loaders: ['fabric'],
            enabled: true,
          },
          {
            id: 'beta',
            name: 'Beta Mod',
            version: '2.0.0',
            hash: { sha1: 'beta-hash' },
            file: { name: 'beta.jar', path: '/mods/beta.jar', size: 256, mtimeMs: 2 },
            deps: [],
            loaders: ['fabric'],
            enabled: true,
          },
        ]}
        loadingMods={false}
        modSearchQuery=""
        onModSearchQueryChange={vi.fn()}
        modFilterStatus="all"
        onModFilterStatusChange={vi.fn()}
        onAddMod={vi.fn()}
        onRemoveMod={vi.fn().mockResolvedValue(undefined)}
        t={t}
        getAccentStyles={() => ({ className: '', style: undefined })}
      />,
    );

    expect(screen.getByText('Alpha Mod')).toBeTruthy();
    expect(screen.getByText('Beta Mod')).toBeTruthy();
    expect(hasClassFragment(container, 'h-[800px]')).toBe(false);
  });
});
