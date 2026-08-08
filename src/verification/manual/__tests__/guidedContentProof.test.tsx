// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installManualVerificationEnvironment, seedManualVerificationStorage } from '../mockEnvironment';
import { ManualVerificationScenarios } from '../scenarios';
import type { ManualVerificationView } from '../views';

const marketplaceFramingPattern = /\b(marketplace|wishlist|store|storefront)\b/i;

vi.mock('../../../components/TitleBar', () => ({
  default: () => <div>Burrow</div>,
}));

vi.mock('../../../components/Sidebar', () => ({
  default: () => <div>Sidebar</div>,
}));

vi.mock('../../../features/launcher/hooks/useModSupportedVersions', () => ({
  useModSupportedVersions: () => ({
    forgeVersions: ['1.20.1'],
    fabricVersions: ['1.20.1'],
    optiFineVersions: ['1.20.1'],
    neoForgeVersions: ['1.20.1'],
    isLoading: false,
  }),
}));

function renderGuidedView(view: ManualVerificationView) {
  window.history.replaceState({}, '', `?view=${view}`);
  localStorage.clear();
  seedManualVerificationStorage(view);
  installManualVerificationEnvironment();

  const onReady = vi.fn();
  render(<ManualVerificationScenarios view={view} onReady={onReady} />);

  return { onReady };
}

function getGuidedSurfaceText() {
  return screen.getByTestId('add-mod-page-body').textContent ?? '';
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('guided manual verification proof', () => {
  it('renders the guided resource-pack browser with direct fallback proof instead of generic mod fixtures', async () => {
    const { onReady } = renderGuidedView('guided-resourcepacks');

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        'Phase 35 guided resource-pack browser proof rendered with direct catalog fixtures, explicit local fallback, and runtime-scoped copy on the live route.',
      );
    }, { timeout: 4000 });

    const text = getGuidedSurfaceText();
    expect(text).toContain('Painterly Depth Reloaded');
    expect(text).toContain('Have a local resource pack .zip already?');
    expect(text).toContain('Instance-scoped resource packs');
    expect(text).not.toContain('Sodium');
    expect(text).not.toMatch(marketplaceFramingPattern);
  });

  it('renders the guided shader browser with needs-setup runtime guidance', async () => {
    const { onReady } = renderGuidedView('guided-shaders');

    const capability = await screen.findByTestId('guided-content-shader-capability');

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        'Phase 35 guided shader browser proof rendered with needs-setup runtime guidance, shader-specific fixtures, and honest live-route capability copy.',
      );
    }, { timeout: 4000 });

    expect(capability.getAttribute('data-status')).toBe('needs-setup');
    expect(getGuidedSurfaceText()).toContain('Photon Bloom Lite');
    expect(getGuidedSurfaceText()).toContain('Have a local shader pack .zip already?');
    expect(getGuidedSurfaceText()).not.toMatch(marketplaceFramingPattern);
  });

  it('drives the guided resource-pack fallback into partial recovery proof', async () => {
    const { onReady } = renderGuidedView('guided-resourcepacks-recovery');

    const notice = await screen.findByTestId('add-mod-page-notice', {}, { timeout: 4000 });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        'Phase 35 guided resource-pack fallback proof rendered with partial local-import recovery that stays on-surface.',
      );
    }, { timeout: 4000 });

    expect(notice.textContent ?? '').toContain('Added 1 resource packs. The remaining issues stayed on this screen.');
    expect(notice.textContent ?? '').toContain('Broken Painterly Draft.zip');
    expect(getGuidedSurfaceText()).not.toMatch(marketplaceFramingPattern);
  });

  it('drives the guided shader proof into unsupported runtime recovery', async () => {
    const { onReady } = renderGuidedView('guided-shaders-recovery');

    const capability = await screen.findByTestId('guided-content-shader-capability');
    const notice = await screen.findByTestId('add-mod-page-notice', {}, { timeout: 4000 });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(
        'Phase 35 guided shader recovery proof rendered with unsupported runtime guidance and retry-ready blocked install copy.',
      );
    }, { timeout: 4000 });

    expect(capability.getAttribute('data-status')).toBe('unsupported');
    expect(notice.textContent ?? '').toContain(
      'Photon Bloom Lite: This shader is blocked for the current runtime.',
    );
    expect(notice.textContent ?? '').toContain('Review the shader runtime card above, then retry.');
    expect(getGuidedSurfaceText()).not.toMatch(marketplaceFramingPattern);
  });
});
