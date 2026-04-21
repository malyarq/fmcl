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

    expect(screen.getByTestId('sidebar-mode-simple-glyph')).toBeTruthy();
    expect(screen.getByTestId('sidebar-mode-modpacks-glyph')).toBeTruthy();
    expect(screen.queryByText(/^M$/)).toBeNull();

    expect(classicButton.getAttribute('aria-pressed')).toBe('false');
    expect(modpacksButton.getAttribute('aria-pressed')).toBe('true');
    expect(modpacksButton.className).toContain('bg-card');
    expect(modpacksButton.getAttribute('title')).toBe('Modpacks');

    fireEvent.click(classicButton);

    expect(onChangeMode).toHaveBeenCalledWith('simple');
  });

  it('keeps the expanded header oriented with a compact app row instead of a standalone build block', () => {
    renderExpandedHeader();

    expect(screen.getByTestId('sidebar-app-icon')).toBeTruthy();
    expect(screen.getByText('Modpacks • v0.4.0')).toBeTruthy();
    expect(screen.queryByText('Build v0.4.0')).toBeNull();
  });
});
