// @vitest-environment jsdom

import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderCatalogAPI } from '@shared/contracts';
import { Modal } from '../ui/Modal';
import { DegradedStateView } from '../layout/DegradedStateView';
import { ModpackBrowser } from '../modpacks/ModpackBrowser';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../features/modpacks/hooks/useModpackNavigation';

const mocks = vi.hoisted(() => ({
  search: vi.fn<ProviderCatalogAPI['search']>(),
  versions: vi.fn<ProviderCatalogAPI['versions']>(),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) => key,
    getAccentStyles: () => ({ className: '', style: undefined }),
    formatDate: (value: number | undefined) => value ? String(value) : 'unknown',
    formatNumber: (value: number) => String(value),
  }),
}));

vi.mock('../../hooks/useDebounce', () => ({
  useDebounce: <T,>(value: T) => value,
}));

vi.mock('../../services/ipc/providerCatalogIPC', () => ({
  providerCatalogIPC: {
    search: (...args: Parameters<ProviderCatalogAPI['search']>) => mocks.search(...args),
    versions: (...args: Parameters<ProviderCatalogAPI['versions']>) => mocks.versions(...args),
  },
}));

vi.mock('../../services/ipc/dialogIPC', () => ({
  dialogIPC: { showOpenDialog: vi.fn() },
}));

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open workflow</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Workflow">
        <button type="button">Primary workflow action</button>
      </Modal>
    </>
  );
}

describe('Phase 41 renderer interaction characterization', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.search.mockReset().mockResolvedValue({
      items: [{
        platform: 'modrinth',
        projectId: 'keyboard-pack',
        title: 'Keyboard Pack',
        description: 'Characterized result',
        downloads: 42,
      }],
      total: 1,
      offset: 0,
      limit: 12,
    });
    mocks.versions.mockReset().mockResolvedValue([]);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  it('keeps modal focus, Escape close, and focus return in the current workflow', async () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open workflow' });
    trigger.focus();
    fireEvent.click(trigger);

    const action = await screen.findByRole('button', { name: 'Primary workflow action' });
    await waitFor(() => expect(document.activeElement).toBe(action));

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('distinguishes visible error recovery from empty state with accessible live semantics', () => {
    render(
      <DegradedStateView
        variant="error"
        layout="workspace"
        label="Needs attention"
        title="Catalog unavailable"
        description="Retry without leaving this route."
        testId="characterized-error"
      />,
    );

    const state = screen.getByRole('alert');
    expect(state.getAttribute('aria-live')).toBe('assertive');
    expect(state.getAttribute('data-layout')).toBe('workspace');
    expect(state.textContent).toContain('Retry without leaving this route.');
  });

  it('keeps provider results natively keyboard-activatable through the route callback', async () => {
    const onNavigate = vi.fn();
    render(
      <ModpackBrowser
        initialState={{ ...DEFAULT_MODPACK_BROWSER_STATE, platform: 'modrinth' }}
        onBack={vi.fn()}
        onNavigate={onNavigate}
        onStateChange={vi.fn()}
      />,
    );

    await screen.findByRole('search', { name: 'modpacks.search' });
    const result = await screen.findByRole('button', { name: 'Keyboard Pack' });
    expect(result.tagName).toBe('BUTTON');
    fireEvent.click(result);

    await waitFor(() => expect(mocks.versions).toHaveBeenCalledWith({
      platform: 'modrinth',
      projectId: 'keyboard-pack',
    }));
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ type: 'install' }));
  });
});
