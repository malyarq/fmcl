import { expect, test, type Page } from '@playwright/test';
import { PLAYWRIGHT_CLOSEOUT_VIEWS } from '../../src/verification/manual/views';

function getViewport(viewport: 'desktop' | 'wide' | undefined) {
  if (viewport === 'wide') {
    return { width: 1600, height: 1360 };
  }

  return { width: 1280, height: 1024 };
}

async function waitForVerificationReady(page: Page, viewId: string) {
  await expect
    .poll(async () => {
      const rawStatus = await page.locator('#verification-status').textContent();

      if (!rawStatus) {
        return 'missing';
      }

      try {
        const status = JSON.parse(rawStatus) as { ready?: boolean; view?: string };
        return status.ready && status.view === viewId ? 'ready' : JSON.stringify(status);
      } catch {
        return 'invalid';
      }
    }, { timeout: 15_000, intervals: [100, 200, 400, 800] })
    .toBe('ready');
}

test.describe('v0.5.0 closeout screenshots', () => {
  for (const view of PLAYWRIGHT_CLOSEOUT_VIEWS) {
    test(view.id, async ({ page }) => {
      await page.setViewportSize(getViewport(view.viewport));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/manual-verification.html?view=${view.id}`);
      await waitForVerificationReady(page, view.id);
      await page.addStyleTag({
        content: `
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
            scroll-behavior: auto !important;
          }
        `,
      });
      await page.waitForTimeout(150);

      for (const forbidden of view.forbidText ?? []) {
        await expect(page.locator('body')).not.toContainText(forbidden);
      }

      await expect(page).toHaveScreenshot(`${view.id}.png`, {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixels: 0,
        maxDiffPixelRatio: 0,
        scale: 'css',
        threshold: 0,
      });
    });
  }
});
