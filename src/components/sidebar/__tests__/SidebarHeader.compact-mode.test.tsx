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
});
