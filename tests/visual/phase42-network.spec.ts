import { expect, test } from '@playwright/test';

const routes = [
  { view: 'phase-42-tunnel-en', readyText: 'Room Active!', forbiddenText: 'Scan local network' },
  { view: 'phase-42-lan-ru', readyText: 'Мир Beta Pack', forbiddenText: 'Код Комнаты' },
] as const;

for (const route of routes) {
  test(route.view, async ({ page }) => {
    await page.setViewportSize({ width: 760, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('mp_room_code', 'phantom-room');
      localStorage.setItem('mp_mapped_port', '12345');
    });
    await page.goto(`/manual-verification.html?view=${route.view}`);
    await expect(page.getByText(route.readyText).first()).toBeVisible();
    await expect.poll(async () => JSON.parse(await page.locator('#verification-status').textContent() || '{}').ready).toBe(true);
    await expect(page.locator('body')).not.toContainText(route.forbiddenText);
    await expect.poll(async () => await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(async () => await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return false;
      const bounds = dialog.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight;
    })).toBe(true);
    await expect.poll(async () => await page.evaluate(() => ({
      room: localStorage.getItem('mp_room_code'),
      mapped: localStorage.getItem('mp_mapped_port'),
    }))).toEqual({ room: null, mapped: null });
  });
}
