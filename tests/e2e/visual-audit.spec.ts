import { test } from "@playwright/test";

/** Uses Playwright `baseURL` (PLAYWRIGHT_BASE_URL or http://127.0.0.1:3000) — same as playwright.config.ts / CI on 3100. */
const screens = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "pricing", path: "/pricing" },
  { name: "not-found", path: "/this-route-does-not-exist" },
  { name: "today", path: "/today" },
  { name: "discover", path: "/discover" },
  { name: "progress", path: "/progress" },
  { name: "plan", path: "/plan" },
  { name: "settings", path: "/settings" },
  { name: "shopping", path: "/shopping" },
];

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const screen of screens) {
  for (const vp of viewports) {
    test(`visual-audit ${screen.name} ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(screen.path);
      await page.waitForTimeout(2000);

      const acceptBtn = page.locator('button:has-text("Accept all")');
      if (await acceptBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await acceptBtn.click();
        await page.waitForTimeout(500);
      }

      const dismissBtn = page.locator('button:has-text("Dismiss checklist")');
      if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dismissBtn.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({
        path: `screenshots/visual-audit/${screen.name}-${vp.name}.png`,
        fullPage: false,
      });
    });
  }
}
