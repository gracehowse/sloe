/**
 * Chromatic E2E archives — captured during `npx playwright test` and uploaded by
 * `chromaui/action` with `playwright: true`. Do not use toHaveScreenshot here;
 * visual baselines live in Chromatic, not in-repo PNGs.
 *
 * landing + pricing only — /login and 404 carry Apple Sign-In CSP that blocks
 * Chromatic's archive script (inline script-src).
 */
import { test, expect } from "@chromatic-com/playwright";
import { dismissVisualOverlays, seedConsent, stabilizeForScreenshot } from "./utils/visual";

const screens = [
  { name: "landing", path: "/" },
  { name: "pricing", path: "/pricing" },
] as const;

test.describe("Chromatic — public shell", () => {
  test.describe.configure({ mode: "parallel" });

  for (const screen of screens) {
    for (const vp of [
      { name: "mobile", width: 390, height: 844 },
      { name: "desktop", width: 1440, height: 900 },
    ] as const) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await seedConsent(page);
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page, screen.name === "landing" ? 3000 : 2500);
        await expect(page.locator("body")).toBeVisible();
      });
    }
  }
});
