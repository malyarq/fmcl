import {
  CORE_VIEWS,
  type ManualVerificationView,
  type ManualVerificationViewMeta,
} from './views';

export type QualityRouteLocale = 'en' | 'ru';

export type QualityRouteViewport =
  | { name: 'narrow'; width: 760; height: 900 }
  | { name: 'desktop'; width: 1280; height: 1024 };

export type QualityRouteInteraction =
  | 'launcher-home'
  | 'installed-list-detail'
  | 'provider-content'
  | 'networking';

export const PHASE41_SURFACES_SCROLL_OWNER = '[data-testid="phase41-surfaces-proof"]' as const;

export type QualityRouteReadiness = Readonly<{
  view: ManualVerificationView;
  ready: true;
  step: 'rendered';
}>;

export type QualityManualRoute = Readonly<{
  id: string;
  view: ManualVerificationView;
  locale: QualityRouteLocale;
  viewport: QualityRouteViewport;
  interaction: QualityRouteInteraction;
  blurScrollTarget?: typeof PHASE41_SURFACES_SCROLL_OWNER;
  forbiddenText: readonly string[];
  readiness: QualityRouteReadiness;
}>;

function requireViewMeta(view: ManualVerificationView): ManualVerificationViewMeta {
  const metadata = CORE_VIEWS.find((candidate) => candidate.id === view);

  if (!metadata) {
    throw new Error(`Quality route references an unregistered manual verification view: ${view}`);
  }

  return metadata;
}

function createQualityManualRoute(
  route: Omit<QualityManualRoute, 'forbiddenText' | 'readiness'>,
): QualityManualRoute {
  const metadata = requireViewMeta(route.view);

  return {
    ...route,
    forbiddenText: metadata.forbidText ?? [],
    readiness: {
      view: route.view,
      ready: true,
      step: 'rendered',
    },
  };
}

export const QUALITY_MANUAL_ROUTES: readonly QualityManualRoute[] = [
  createQualityManualRoute({
    id: 'launcher-home-en',
    view: 'phase-41-ownership-en',
    locale: 'en',
    viewport: { name: 'desktop', width: 1280, height: 1024 },
    interaction: 'launcher-home',
  }),
  createQualityManualRoute({
    id: 'installed-list-detail-ru',
    view: 'phase-41-ownership-ru',
    locale: 'ru',
    viewport: { name: 'narrow', width: 760, height: 900 },
    interaction: 'installed-list-detail',
  }),
  createQualityManualRoute({
    id: 'provider-content-en',
    view: 'phase-41-surfaces-en',
    locale: 'en',
    viewport: { name: 'desktop', width: 1280, height: 1024 },
    interaction: 'provider-content',
    blurScrollTarget: PHASE41_SURFACES_SCROLL_OWNER,
  }),
  createQualityManualRoute({
    id: 'provider-content-ru',
    view: 'phase-41-surfaces-ru',
    locale: 'ru',
    viewport: { name: 'narrow', width: 760, height: 900 },
    interaction: 'provider-content',
    blurScrollTarget: PHASE41_SURFACES_SCROLL_OWNER,
  }),
  createQualityManualRoute({
    id: 'network-tunnel-en',
    view: 'phase-42-tunnel-en',
    locale: 'en',
    viewport: { name: 'narrow', width: 760, height: 900 },
    interaction: 'networking',
  }),
  createQualityManualRoute({
    id: 'network-lan-ru',
    view: 'phase-42-lan-ru',
    locale: 'ru',
    viewport: { name: 'desktop', width: 1280, height: 1024 },
    interaction: 'networking',
  }),
];

export function getQualityManualRoute(id: string): QualityManualRoute | undefined {
  return QUALITY_MANUAL_ROUTES.find((route) => route.id === id);
}

export function isQualityManualRouteReady(
  route: QualityManualRoute,
): boolean {
  return route.readiness.view === route.view
    && route.readiness.ready
    && route.readiness.step === 'rendered';
}
