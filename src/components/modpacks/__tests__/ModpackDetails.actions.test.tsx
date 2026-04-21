// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../contexts/settings/i18n';
import { ModpackDetailsActions } from '../details/ModpackDetailsActions';

function renderActions(hasUpdate: boolean) {
  return render(
    <ModpackDetailsActions
      onLaunch={vi.fn()}
      hasUpdate={hasUpdate}
      onShowUpdate={vi.fn()}
      updateVersionSummary={hasUpdate ? '1.0.0 → 1.1.0' : null}
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
    const actions = screen.getByTestId('modpack-details-actions');
    expect(primaryButtons).toHaveLength(1);
    expect(actions.className).not.toContain('surface-card');
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('data-route-action')).toBe('play');
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('data-primary-action')).toBe('route');
    expect(screen.getByRole('button', { name: 'Rename' }).className).toContain('min-h-9');
    expect(screen.getByRole('button', { name: 'Duplicate' }).className).toContain('min-h-9');
    expect(screen.getByRole('button', { name: 'Export' }).className).toContain('min-h-9');
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('min-h-9');
  });

  it('keeps Play as the only route-primary action and renders update as a non-blocking notice', () => {
    renderActions(true);

    const primaryButtons = document.querySelectorAll('[data-primary-action="route"]');
    expect(primaryButtons).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('data-route-action')).toBe('play');
    expect(screen.getByRole('button', { name: 'Play' }).getAttribute('data-primary-action')).toBe('route');

    const updateButton = screen.getByRole('button', { name: /review update/i });
    const updateNotice = screen.getByTestId('modpack-details-update-notice');
    expect(updateNotice.getAttribute('data-update-scope')).toBe('modpack-local');
    expect(updateButton.getAttribute('data-route-action')).toBe('update');
    expect(updateButton.getAttribute('data-primary-action')).toBeNull();
    expect(updateButton.getAttribute('data-variant')).toBe('ghost');
    expect(updateButton.className).not.toContain('w-full');
    expect(within(screen.getByTestId('modpack-details-actions')).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByTestId('modpack-details-update-notice').textContent).toContain('1.0.0 → 1.1.0');
  });
});
