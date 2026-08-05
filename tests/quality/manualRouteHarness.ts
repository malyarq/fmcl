import { expect, type Page } from '@playwright/test';
import type { QualityManualRoute } from '../../src/verification/manual/qualityRoutes';

export type ManualVerificationStatus = Readonly<{
  view: QualityManualRoute['view'];
  ready: true;
  step: 'rendered';
}>;

export function getManualVerificationRouteUrl(route: QualityManualRoute): string {
  return `/manual-verification.html?${new URLSearchParams({ view: route.view }).toString()}`;
}

export function parseManualVerificationStatus(
  rawStatus: string | null,
  route: QualityManualRoute,
): ManualVerificationStatus {
  if (!rawStatus) {
    throw new Error('Manual verification status is missing.');
  }

  let status: unknown;
  try {
    status = JSON.parse(rawStatus);
  } catch {
    throw new Error('Manual verification status is invalid JSON.');
  }

  if (typeof status !== 'object' || status === null
    || (status as Record<string, unknown>).view !== route.readiness.view
    || (status as Record<string, unknown>).ready !== true
    || (status as Record<string, unknown>).step !== 'rendered') {
    throw new Error(`Manual verification status is not ready for ${route.view}.`);
  }

  return route.readiness;
}

export async function waitForManualVerificationReady(
  page: Page,
  route: QualityManualRoute,
): Promise<ManualVerificationStatus> {
  await expect.poll(async () => {
    const rawStatus = await page.locator('#verification-status').textContent();
    try {
      parseManualVerificationStatus(rawStatus, route);
      return 'ready';
    } catch (error) {
      return error instanceof Error ? error.message : 'invalid verification status';
    }
  }, {
    timeout: 15_000,
    intervals: [100, 200, 400, 800],
  }).toBe('ready');

  return route.readiness;
}

export async function assertQualityRouteContainment(
  page: Page,
  route: QualityManualRoute,
): Promise<void> {
  await expect.poll(async () => page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);

  if (route.blurScrollTarget) {
    await expect(page.locator(route.blurScrollTarget)).toBeVisible();
  }
}

export async function navigateToQualityManualRoute(
  page: Page,
  route: QualityManualRoute,
): Promise<ManualVerificationStatus> {
  await page.setViewportSize(route.viewport);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(getManualVerificationRouteUrl(route));

  const status = await waitForManualVerificationReady(page, route);

  for (const forbiddenText of route.forbiddenText) {
    await expect(page.locator('body')).not.toContainText(forbiddenText);
  }
  await assertQualityRouteContainment(page, route);

  return status;
}
