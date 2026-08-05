import { describe, expect, it } from 'vitest';
import { CORE_VIEWS, getManualVerificationView } from '../views';
import {
  QUALITY_MANUAL_ROUTES,
  getQualityManualRoute,
  isQualityManualRouteReady,
  PHASE41_SURFACES_SCROLL_OWNER,
} from '../qualityRoutes';

describe('quality manual routes', () => {
  it('selects only registered production manual views with deterministic readiness metadata', () => {
    const registeredViews = new Set(CORE_VIEWS.map((view) => view.id));

    expect(QUALITY_MANUAL_ROUTES).toHaveLength(6);
    expect(new Set(QUALITY_MANUAL_ROUTES.map((route) => route.id)).size).toBe(QUALITY_MANUAL_ROUTES.length);

    for (const route of QUALITY_MANUAL_ROUTES) {
      expect(registeredViews.has(route.view)).toBe(true);
      expect(getManualVerificationView(route.view)).toBe(route.view);
      expect(isQualityManualRouteReady(route)).toBe(true);
      expect(route.readiness).toEqual({
        view: route.view,
        ready: true,
        step: 'rendered',
      });
    }
  });

  it('covers both locales and all representative quality interaction classes without synthetic views', () => {
    expect(new Set(QUALITY_MANUAL_ROUTES.map((route) => route.locale))).toEqual(new Set(['en', 'ru']));
    expect(new Set(QUALITY_MANUAL_ROUTES.map((route) => route.interaction))).toEqual(new Set([
      'launcher-home',
      'installed-list-detail',
      'provider-content',
      'networking',
    ]));
    expect(QUALITY_MANUAL_ROUTES.some((route) => route.blurScrollTarget)).toBe(true);
    expect(QUALITY_MANUAL_ROUTES.every((route) => !route.view.startsWith('quality-'))).toBe(true);
  });

  it('resolves routes by their stable quality identifier', () => {
    expect(getQualityManualRoute('network-lan-ru')?.view).toBe('phase-42-lan-ru');
    expect(getQualityManualRoute('missing-route')).toBeUndefined();
  });

  it('targets the actual Phase 41 surfaces scroll owner for provider performance evidence', () => {
    expect(getQualityManualRoute('provider-content-en')?.blurScrollTarget).toBe(PHASE41_SURFACES_SCROLL_OWNER);
    expect(getQualityManualRoute('provider-content-ru')?.blurScrollTarget).toBe(PHASE41_SURFACES_SCROLL_OWNER);
    expect(PHASE41_SURFACES_SCROLL_OWNER).toBe('[data-testid="phase41-surfaces-proof"]');
  });
});
