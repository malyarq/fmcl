// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LauncherTab } from '../tabs/LauncherTab';

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../../services/ipc/cacheIPC', () => ({
  cacheIPC: {
    has: () => false,
    getImageCacheState: vi.fn(),
    setImageCacheLimit: vi.fn(),
    cleanupImageCache: vi.fn(),
  },
}));

vi.mock('../tabs/game/MinecraftPathSection', () => ({
  MinecraftPathSection: () => <div>Minecraft path surface</div>,
}));

describe('LauncherTab layout', () => {
  it('keeps launcher controls inside the shared control family when embedded in SettingsPage', () => {
    const { container } = render(
      <LauncherTab
        embedded
        hideLauncher={false}
        setHideLauncher={vi.fn()}
        showConsole={false}
        setShowConsole={vi.fn()}
        minecraftPath="/minecraft"
        setMinecraftPath={vi.fn()}
        t={(key) =>
          ({
            'settings.tab_launcher': 'Launcher',
            'settings.performance': 'Hide launcher while playing',
            'settings.performance_desc': 'Hide launcher window while playing to save resources.',
            'settings.console': 'Developer console',
            'settings.console_desc': 'Keep the developer console available while diagnosing launcher issues.',
            'settings.ui_zoom': 'Interface Zoom',
            'settings.animations': 'Enable Animations',
            'settings.animations_scope_desc': 'Controls launcher motion and background effects without changing preset colors or surfaces.',
            'settings.compact_mode': 'Compact Mode',
            'settings.compact_mode_desc': 'Tightens launcher spacing and list density; it does not change the active preset.',
            'settings.sidebar_position': 'Sidebar Position',
            'settings.sidebar_position_left': 'Left',
            'settings.sidebar_position_right': 'Right',
            'settings.sidebar_position_desc': 'Moves launcher navigation only; preset visuals stay unchanged.',
            'settings.launcher_runtime_title': 'Launcher Runtime',
            'settings.launcher_runtime_desc': 'Tune how the launcher behaves while you play, debug issues, and navigate the shell.',
            'settings.updatesTitle': 'Updates',
            'settings.updatesDesc': 'Check for launcher updates on demand.',
            'settings.reset': 'Reset',
            'updater.check': 'Check for updates and keep the launcher shell aligned',
            'settings.clear_cache': 'Clear cache and reload the launcher shell cleanly',
          }[key] ?? key)
        }
        uiScale={110}
        setUiScale={vi.fn()}
        disableAnimations={false}
        setDisableAnimations={vi.fn()}
        sidebarPosition="left"
        setSidebarPosition={vi.fn()}
        compactMode
        setCompactMode={vi.fn()}
        status="idle"
        updateInfo={null}
        onCheckForUpdates={async () => {}}
        onBeforeCheckForUpdates={vi.fn()}
      />,
    );

    const root = container.firstElementChild as HTMLElement;
    const runtimeShell = screen.getByText('Launcher Runtime').closest('.settings-section-shell') as HTMLElement;
    const runtimeGrid = screen.getByTestId('launcher-runtime-grid');
    const slider = screen.getAllByRole('slider')[0];
    const hideLauncherToggle = screen.getByRole('switch', { name: 'Hide launcher while playing' });
    const sidebarRow = screen.getByText('Sidebar Position').closest('.settings-control-card') as HTMLElement;
    const updatesButton = screen.getByRole('button', { name: 'Check for updates and keep the launcher shell aligned' });
    const clearCacheButton = screen.getByRole('button', { name: 'Clear cache and reload the launcher shell cleanly' });

    expect(root.className).toContain('xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]');
    expect(screen.queryByRole('heading', { name: 'Launcher' })).toBeNull();
    expect(runtimeShell.className).toContain('min-w-0');
    expect(runtimeGrid.className).toContain('xl:grid-cols-3');
    expect(hideLauncherToggle.className).toContain('settings-toggle-switch');
    expect(hideLauncherToggle.closest('.settings-toggle-row')).toBeTruthy();
    expect(slider.className).toContain('settings-slider');
    expect(sidebarRow.className).toContain('settings-control-card');
    expect(screen.getByRole('button', { name: 'Left' }).className).toContain('settings-segmented-option');
    expect(updatesButton.getAttribute('data-button-geometry')).toBe('utility');
    expect(updatesButton.className).toContain('whitespace-normal');
    expect(updatesButton.className).toContain('leading-tight');
    expect(updatesButton.className).toContain('w-full');
    expect(clearCacheButton.getAttribute('data-button-geometry')).toBe('utility');
    expect(clearCacheButton.className).toContain('whitespace-normal');
    expect(clearCacheButton.className).toContain('w-full');
    expect(screen.getByText('Minecraft path surface')).toBeTruthy();
  });
});
