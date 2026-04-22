// @vitest-environment jsdom

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AccentStyleType } from '../../../contexts/settings/types';
import { SettingsTabsHeader } from '../SettingsTabsHeader';

function getAccentStyles(type: AccentStyleType) {
  switch (type) {
    case 'soft-bg':
      return { style: { backgroundColor: 'rgba(18, 52, 86, 0.12)' } };
    case 'soft-border':
      return { style: { borderColor: 'rgba(18, 52, 86, 0.24)' } };
    case 'title':
      return { style: { color: '#123456' } };
    default:
      return {};
  }
}

describe('SettingsTabsHeader state fidelity', () => {
  it('renders active tabs with accent-backed styles and keeps inactive tabs readable', () => {
    render(
      <SettingsTabsHeader
        activeTab="downloads"
        onTabChange={() => {}}
        t={(key) => key}
        getAccentStyles={getAccentStyles}
      />,
    );

    const tabList = screen.getByRole('tablist', { name: 'settings.title' });
    const downloadsTab = screen.getByRole('tab', { name: 'Downloads' });
    const appearanceTab = screen.getByRole('tab', { name: 'Appearance' });
    const downloadsLabel = within(downloadsTab).getByText('Downloads');

    expect(tabList.className).toContain('settings-tab-row');
    expect(downloadsTab.getAttribute('data-state')).toBe('active');
    expect(downloadsTab.getAttribute('aria-selected')).toBe('true');
    expect(downloadsTab.className).toContain('settings-segmented-option');
    expect(downloadsTab.className).toContain('settings-tab-option');
    expect(downloadsTab.className).toContain('bg-card/92');
    expect(downloadsTab.style.backgroundColor).toContain('18, 52, 86');
    expect(downloadsTab.style.borderColor).toContain('18, 52, 86');
    expect(downloadsLabel.style.color).toBe('rgb(18, 52, 86)');
    expect(downloadsTab.textContent).toBe('Downloads');

    expect(appearanceTab.getAttribute('data-state')).toBe('inactive');
    expect(appearanceTab.getAttribute('aria-selected')).toBe('false');
    expect(appearanceTab.className).toContain('settings-segmented-option');
    expect(appearanceTab.className).toContain('settings-tab-option');
    expect(appearanceTab.className).toContain('bg-transparent');
    expect(appearanceTab.textContent).toBe('Appearance');
  });
});
