// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameTab } from '../tabs/GameTab';

const scanJavaMock = vi.fn();

vi.mock('../../../services/ipc/javaRuntimeIPC', () => ({
  javaRuntimeIPC: {
    scan: (...args: unknown[]) => scanJavaMock(...args),
    select: vi.fn(),
  },
}));

const translations: Record<string, string> = {
  'settings.tab_game': 'Game',
  'settings.extra_jvm_args': 'Extra JVM Args',
  'settings.extra_jvm_args_desc': 'Tune the JVM launch flags.',
  'settings.extra_game_args': 'Extra Game Args',
  'settings.extra_game_args_desc': 'Tune the Minecraft launch flags.',
  'settings.ram': 'Max Memory (Xmx)',
  'settings.min_ram': 'Initial Memory (Xms)',
  'general.show_advanced': 'Show Advanced',
  'general.hide_advanced': 'Hide Advanced',
  'settings.java_path': 'Java Version',
  'general.rescan': 'Rescan',
  'general.scanning': 'Scanning...',
  'settings.java_auto': 'Auto (Recommended)',
  'settings.java_custom': 'Custom Path...',
  'settings.window_width': 'Window Width',
  'settings.window_height': 'Window Height',
  'settings.fullscreen': 'Fullscreen',
  'settings.fullscreen_desc': 'Launch directly into fullscreen mode.',
  'settings.autoconnect': 'Auto Connect',
  'settings.autoconnect_desc': 'Reconnect to the configured server automatically.',
  'settings.server_host': 'Server Host',
  'settings.server_port': 'Server Port',
};

function t(key: string) {
  return translations[key] ?? key;
}

function getAccentStyles() {
  return { className: 'accent-range', style: undefined };
}

function getTextboxByLabel(label: string) {
  const field = screen.getByText(label).closest('div');
  if (!field) {
    throw new Error(`Field group not found for ${label}`);
  }

  return within(field).getByRole('textbox');
}

describe('GameTab theme surface contrast', () => {
  beforeEach(() => {
    scanJavaMock.mockReset();
    scanJavaMock.mockResolvedValue([]);
  });

  it('uses semantic wrappers and shared control classes on the highest-risk settings surfaces', async () => {
    const { container } = render(
      <GameTab
        modpackConfig={null}
        setMemoryGb={vi.fn()}
        setMinMemoryGb={vi.fn()}
        setVmOptions={vi.fn()}
        setGameExtraArgs={vi.fn()}
        setGameResolution={vi.fn()}
        setAutoConnectServer={vi.fn()}
        t={t}
        getAccentStyles={getAccentStyles}
      />,
    );

    await waitFor(() => {
      expect(scanJavaMock).toHaveBeenCalled();
    });

    expect(screen.getByText('Game').closest('.surface-soft')).toBeTruthy();
    expect(getTextboxByLabel('Extra JVM Args').className).toContain('control-frame');
    expect(getTextboxByLabel('Extra Game Args').className).toContain('control-frame');
    expect(screen.getByRole('combobox').className).toContain('control-frame');
    expect(screen.getByText('Fullscreen').closest('.surface-soft')).toBeTruthy();
    expect(screen.getByText('Auto Connect').closest('.surface-soft')).toBeTruthy();
    expect(container.querySelectorAll('.helper-text').length).toBeGreaterThanOrEqual(4);
  });
});
