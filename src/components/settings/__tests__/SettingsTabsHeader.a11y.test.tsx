// @vitest-environment jsdom

import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsTabsHeader } from '../SettingsTabsHeader';
import { getSettingsPanelId, getSettingsTabId, type SettingsTabId } from '../settingsTabs';

describe('SettingsTabsHeader accessibility', () => {
  it('renders a tablist without duplicate tabs and supports keyboard navigation', async () => {
    const Harness = () => {
      const [activeTab, setActiveTab] = useState<SettingsTabId>('appearance');

      return (
        <>
          <SettingsTabsHeader
            activeTab={activeTab}
            onTabChange={setActiveTab}
            t={(key) => key}
            getAccentStyles={() => ({})}
          />
          <div
            id={getSettingsPanelId(activeTab)}
            role="tabpanel"
            aria-labelledby={getSettingsTabId(activeTab)}
          >
            {activeTab}
          </div>
        </>
      );
    };

    render(<Harness />);

    expect(screen.getByRole('tablist', { name: 'settings.title' })).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getAllByRole('tab', { name: 'settings.tab_storage' })).toHaveLength(1);

    const appearance = screen.getByRole('tab', { name: 'settings.tab_appearance' });
    const downloads = screen.getByRole('tab', { name: 'settings.tab_downloads' });
    const statistics = screen.getByRole('tab', { name: 'settings.tab_statistics' });

    appearance.focus();
    fireEvent.keyDown(appearance, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(document.activeElement).toBe(downloads);
    });
    expect(downloads.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(downloads, { key: 'End' });

    await waitFor(() => {
      expect(document.activeElement).toBe(statistics);
    });
    expect(statistics.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(statistics, { key: 'Home' });

    await waitFor(() => {
      expect(document.activeElement).toBe(appearance);
    });
    expect(appearance.getAttribute('aria-selected')).toBe('true');
  });
});
