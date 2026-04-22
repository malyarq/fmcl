// @vitest-environment jsdom

import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarHeader } from '../SidebarHeader';

function renderCollapsedHeader(overrides?: Partial<ComponentProps<typeof SidebarHeader>>) {
  const onChangeMode = vi.fn();

  render(
    <SidebarHeader
      appVersion="0.4.0"
      onShowMultiplayer={vi.fn()}
      onShowSettings={vi.fn()}
      getAccentStyles={() => ({ className: '', style: undefined })}
      getAccentHex={() => '#10b981'}
      isCollapsed={true}
      onToggleCollapse={vi.fn()}
      t={(key: string) =>
        ({
          'sidebar.expand': 'Expand sidebar',
          'multiplayer.title': 'Multiplayer',
          'general.settings': 'Settings',
          'ui_mode.simple': 'Classic',
          'ui_mode.modpacks': 'Modpacks',
        }[key] ?? key)}
      uiMode="modpacks"
      onChangeMode={onChangeMode}
      {...overrides}
    />,
  );

  return { onChangeMode };
}

function renderExpandedHeader(overrides?: Partial<ComponentProps<typeof SidebarHeader>>) {
  render(
    <SidebarHeader
      appVersion="0.4.0"
      onShowMultiplayer={vi.fn()}
      onShowSettings={vi.fn()}
      getAccentStyles={() => ({ className: '', style: undefined })}
      getAccentHex={() => '#10b981'}
      isCollapsed={false}
      onToggleCollapse={vi.fn()}
      t={(key: string) =>
        ({
          'sidebar.expand': 'Expand sidebar',
          'sidebar.collapse': 'Collapse sidebar',
          'multiplayer.title': 'Multiplayer',
          'general.settings': 'Settings',
          'ui_mode.simple': 'Classic',
          'ui_mode.modpacks': 'Modpacks',
        }[key] ?? key)}
      uiMode="modpacks"
      onChangeMode={vi.fn()}
      {...overrides}
    />,
  );
}

describe('SidebarHeader compact mode', () => {
  it('renders collapsed mode buttons as icon-like affordances with explicit names instead of a stray letter', () => {
    const { onChangeMode } = renderCollapsedHeader();

    const classicButton = screen.getByRole('button', { name: 'Classic' });
    const modpacksButton = screen.getByRole('button', { name: 'Modpacks' });
    const expandButton = screen.getByTestId('sidebar-expand-button');
    const modeSwitcher = screen.getByTestId('sidebar-mode-switcher');

    expect(screen.getByTestId('sidebar-mode-simple-glyph')).toBeTruthy();
    expect(screen.getByTestId('sidebar-mode-modpacks-glyph')).toBeTruthy();
    expect(screen.queryByText(/^M$/)).toBeNull();
    expect(expandButton.getAttribute('data-button-geometry')).toBe('compact-control');
    expect(expandButton.className).toContain('h-12');
    expect(expandButton.className).toContain('w-12');
    expect(modeSwitcher.className).toContain('rounded-[18px]');

    expect(classicButton.getAttribute('aria-pressed')).toBe('false');
    expect(modpacksButton.getAttribute('aria-pressed')).toBe('true');
    expect(modpacksButton.className).toContain('bg-card');
    expect(modpacksButton.getAttribute('title')).toBe('Modpacks');
    expect(modpacksButton.className).toContain('min-h-10');
    expect(modpacksButton.className).toContain('rounded-2xl');

    fireEvent.click(classicButton);

    expect(onChangeMode).toHaveBeenCalledWith('simple');
  });

  it('keeps the expanded header readable without a redundant logo block', () => {
    renderExpandedHeader();

    const title = screen.getByTestId('sidebar-app-title');

    expect(title.textContent).toBe('FriendLauncher');
    expect(title.className).not.toContain('truncate');
    expect(screen.getByText('Modpacks • v0.4.0')).toBeTruthy();
    expect(screen.queryByTestId('sidebar-app-icon')).toBeNull();
    expect(screen.queryByText('Build v0.4.0')).toBeNull();
  });
});
