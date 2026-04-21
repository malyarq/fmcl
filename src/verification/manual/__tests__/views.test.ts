import { describe, expect, it } from 'vitest';
import { CORE_VIEWS, getManualVerificationView, isManualVerificationView } from '../views';

const marketplaceFramingPattern = /\b(marketplace|wishlist|store|storefront)\b/i;

describe('manual verification views', () => {
  it('keeps the settings appearance route aligned with Phase 30 truth language', () => {
    const settingsAppearance = CORE_VIEWS.find((view) => view.id === 'settings-appearance');

    expect(settingsAppearance).toBeTruthy();
    expect(settingsAppearance?.description).toContain('preset ancestry');
    expect(settingsAppearance?.description.toLowerCase()).not.toContain('shared launcher brand');
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

  it('registers explicit guided resource-pack and shader proof routes for Phase 31', () => {
    const guidedResourcePacks = CORE_VIEWS.find((view) => view.id === 'guided-resourcepacks');
    const guidedResourcePackRecovery = CORE_VIEWS.find((view) => view.id === 'guided-resourcepacks-recovery');
    const guidedShaders = CORE_VIEWS.find((view) => view.id === 'guided-shaders');
    const guidedShaderRecovery = CORE_VIEWS.find((view) => view.id === 'guided-shaders-recovery');

    expect(guidedResourcePacks?.description).toContain('resource-pack browser proof');
    expect(guidedResourcePacks?.description.toLowerCase()).not.toContain('generic add-content');
    expect(guidedResourcePackRecovery?.description).toContain('local import recovery');
    expect(guidedShaders?.description).toContain('needs-setup runtime guidance');
    expect(guidedShaderRecovery?.description).toContain('unsupported-runtime guidance');
    expect(guidedResourcePacks?.description).not.toMatch(marketplaceFramingPattern);
    expect(guidedResourcePackRecovery?.description).not.toMatch(marketplaceFramingPattern);
    expect(guidedShaders?.description).not.toMatch(marketplaceFramingPattern);
    expect(guidedShaderRecovery?.description).not.toMatch(marketplaceFramingPattern);
  });
});
