// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackDetailsActions } from '../details/ModpackDetailsActions';

function renderActions(hasUpdate: boolean) {
  return render(
    <ModpackDetailsActions
      onLaunch={vi.fn()}
      hasUpdate={hasUpdate}
      onShowUpdate={vi.fn()}
      onRename={vi.fn()}
      onDuplicate={vi.fn()}
      onExport={vi.fn()}
      canDelete
      onDelete={vi.fn()}
      t={createTranslator('en')}
      getAccentStyles={() => ({ className: '', style: undefined })}
    />,
  );
}

describe('ModpackDetailsActions primary-action truth', () => {
  it('keeps Play as the only route-primary action when no update is available', () => {
    renderActions(false);

    const primaryButtons = document.querySelectorAll('[data-primary-action="route"]');
    expect(primaryButtons).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('data-route-action')).toBe('play');
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('data-primary-action')).toBe('route');
  });

  it('promotes Update Available to the single route-primary action when an update exists', () => {
    renderActions(true);

    const primaryButtons = document.querySelectorAll('[data-primary-action="route"]');
    expect(primaryButtons).toHaveLength(1);

    const updateButton = screen.getByRole('button', { name: /update available/i });
    expect(updateButton.getAttribute('data-route-action')).toBe('update');
    expect(updateButton.getAttribute('data-primary-action')).toBe('route');

    const playButton = screen.getByRole('button', { name: 'Play' });
    expect(playButton.getAttribute('data-route-action')).toBe('play');
    expect(playButton.getAttribute('data-primary-action')).toBeNull();
  });
});
