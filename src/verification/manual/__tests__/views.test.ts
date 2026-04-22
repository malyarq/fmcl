import { describe, expect, it } from 'vitest';
import { CORE_VIEWS, getManualVerificationView, isManualVerificationView } from '../views';

const marketplaceFramingPattern = /\b(marketplace|wishlist|store|storefront)\b/i;

describe('manual verification views', () => {
  it('keeps the overview and Phase 34 details proof routes aligned with the current closure contract', () => {
    const overview = CORE_VIEWS.find((view) => view.id === 'overview');
    const dashboard = CORE_VIEWS.find((view) => view.id === 'dashboard');
    const modpackList = CORE_VIEWS.find((view) => view.id === 'modpack-list');
    const modpackBrowser = CORE_VIEWS.find((view) => view.id === 'modpack-browser');
    const modpackDetails = CORE_VIEWS.find((view) => view.id === 'modpack-details');
    const legacyDetails = CORE_VIEWS.find((view) => view.id === 'phase-21-details-density');
    const legacySecondary = CORE_VIEWS.find((view) => view.id === 'phase-21-secondary-density');

    expect(overview).toBeTruthy();
    expect(overview?.description).toContain('Phase 34');
    expect(overview?.description).toContain('first-read runtime truth');
    expect(overview?.description.toLowerCase()).not.toContain('classic-truth');

    expect(dashboard).toBeTruthy();
    expect(dashboard?.description).toContain('classic runtime truth');
    expect(dashboard?.description).toContain('actual launch target');
    expect(dashboard?.description.toLowerCase()).not.toContain('one shell-owned play cta');

    expect(modpackList).toBeTruthy();
    expect(modpackList?.description).toContain('compact header');
    expect(modpackList?.description).toContain('minimal card metadata');
    expect(modpackList?.description).toContain('coherent primary actions');
    expect(modpackList?.description.toLowerCase()).not.toContain('dense');

    expect(modpackBrowser).toBeTruthy();
    expect(modpackBrowser?.description).toContain('compact controls');
    expect(modpackBrowser?.description).toContain('minimal card metadata');
    expect(modpackBrowser?.description).toContain('coherent primary actions');
    expect(modpackBrowser?.description).toContain('neutral fallback art');
    expect(modpackBrowser?.description.toLowerCase()).not.toContain('content-heavy');
    expect(modpackBrowser?.description.toLowerCase()).not.toContain('dense');

    expect(modpackDetails).toBeTruthy();
    expect(modpackDetails?.description).toContain('tab reachability above the fold');
    expect(modpackDetails?.description).toContain('first-read runtime authority');
    expect(modpackDetails?.description).toContain('shared content workspace');
    expect(modpackDetails?.description.toLowerCase()).not.toContain('bottom-edge visibility');

    expect(legacyDetails).toBeTruthy();
    expect(legacyDetails?.description).toContain('Retained regression route');
    expect(legacyDetails?.description).toContain('main Phase 34 details proof');
    expect(legacyDetails?.description.toLowerCase()).not.toContain('dense mod content');

    expect(legacySecondary).toBeTruthy();
    expect(legacySecondary?.description).toContain('Retained regression route');
    expect(legacySecondary?.description).toContain('shared-workspace');
    expect(legacySecondary?.description.toLowerCase()).not.toContain('current success criteria');
  });

  it('keeps the settings appearance route aligned with the Phase 36 direct-feedback contract', () => {
    const settingsAppearance = CORE_VIEWS.find((view) => view.id === 'settings-appearance');
    const utilities = CORE_VIEWS.find((view) => view.id === 'utilities');

    expect(settingsAppearance).toBeTruthy();
    expect(settingsAppearance?.description).toContain('behavior-driven');
    expect(settingsAppearance?.description).toContain('duplicate-copy removal');
    expect(settingsAppearance?.description).toContain('preset predictability');
    expect(settingsAppearance?.description).toContain('aligned control geometry');
    expect(settingsAppearance?.description).toContain('visible-effect scope');
    expect(settingsAppearance?.description.toLowerCase()).not.toContain('closeout proof');
    expect(settingsAppearance?.description.toLowerCase()).not.toContain('bounded customization');
    expect(utilities).toBeTruthy();
    expect(utilities?.description).toContain('embedded mirrors and statistics surfaces');
    expect(utilities?.description.toLowerCase()).not.toContain('preset ancestry');
  });

  it('keeps browser-oriented proof routes aligned with the neutral fallback contract', () => {
    const modpackBrowser = CORE_VIEWS.find((view) => view.id === 'modpack-browser');
    const resourcePacks = CORE_VIEWS.find((view) => view.id === 'resource-packs');

    expect(modpackBrowser).toBeTruthy();
    expect(modpackBrowser?.description).toContain('neutral fallback art');
    expect(modpackBrowser?.description.toLowerCase()).not.toContain('launcher branding');
    expect(resourcePacks).toBeTruthy();
    expect(resourcePacks?.description).toContain('shared fallback policy');
    expect(resourcePacks?.description.toLowerCase()).not.toContain('launcher branding');
  });

  it('resolves known view ids while rejecting stale or unknown routes', () => {
    expect(isManualVerificationView('settings-appearance')).toBe(true);
    expect(isManualVerificationView('guided-resourcepacks')).toBe(true);
    expect(isManualVerificationView('guided-shaders-recovery')).toBe(true);
    expect(isManualVerificationView('missing-view')).toBe(false);
    expect(getManualVerificationView('settings-appearance')).toBe('settings-appearance');
    expect(getManualVerificationView('guided-shaders')).toBe('guided-shaders');
    expect(getManualVerificationView('missing-view')).toBe('overview');
  });

  it('registers explicit guided resource-pack and shader proof routes for Phase 35', () => {
    const modpackCreate = CORE_VIEWS.find((view) => view.id === 'modpack-create');
    const modpackAdd = CORE_VIEWS.find((view) => view.id === 'modpack-add');
    const modpackAddModal = CORE_VIEWS.find((view) => view.id === 'modpack-add-modal');
    const guidedResourcePacks = CORE_VIEWS.find((view) => view.id === 'guided-resourcepacks');
    const guidedResourcePackRecovery = CORE_VIEWS.find((view) => view.id === 'guided-resourcepacks-recovery');
    const guidedShaders = CORE_VIEWS.find((view) => view.id === 'guided-shaders');
    const guidedShaderRecovery = CORE_VIEWS.find((view) => view.id === 'guided-shaders-recovery');

    expect(modpackCreate?.description).toContain('fixed action rail');
    expect(modpackCreate?.description).toContain('runtime-aware failure explanations');
    expect(modpackAdd?.description).toContain('fixed action rail');
    expect(modpackAdd?.description).toContain('itemized mixed-success recovery');
    expect(modpackAddModal?.description).toContain('locked exits during install');
    expect(modpackAddModal?.description).toContain('mixed-success recovery');
    expect(guidedResourcePacks?.description).toContain('resource-pack browser proof');
    expect(guidedResourcePacks?.description).toContain('runtime-scoped copy');
    expect(guidedResourcePacks?.description.toLowerCase()).not.toContain('generic add-content');
    expect(guidedResourcePackRecovery?.description).toContain('local import recovery');
    expect(guidedResourcePackRecovery?.description).toContain('retry-ready fallback');
    expect(guidedShaders?.description).toContain('needs-setup runtime guidance');
    expect(guidedShaders?.description).toContain('honest capability copy');
    expect(guidedShaderRecovery?.description).toContain('unsupported-runtime guidance');
    expect(guidedResourcePacks?.description).not.toMatch(marketplaceFramingPattern);
    expect(guidedResourcePackRecovery?.description).not.toMatch(marketplaceFramingPattern);
    expect(guidedShaders?.description).not.toMatch(marketplaceFramingPattern);
    expect(guidedShaderRecovery?.description).not.toMatch(marketplaceFramingPattern);
  });
});
