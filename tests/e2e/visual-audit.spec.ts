import { test, expect } from "@playwright/test";
import {
  dismissVisualOverlays,
  seedConsent,
  stabilizeForScreenshot,
} from "./utils/visual";

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
] as const;

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/** Marketing routes — allow Linux vs macOS font raster drift in CI (see VISUAL_REGRESSION.md). */
const marketingScreenshotOptions = { maxDiffPixelRatio: 0.1 } as const;

test.describe("Visual regression — public shell", () => {
  test.describe.configure({ mode: "parallel" });

  for (const screen of screens) {
    for (const vp of viewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await seedConsent(page);
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page, screen.name === "landing" ? 3000 : 2500);
        // Every public-shell screen renders cross-platform-raster-prone text
        // (and logged-out app routes redirect to the marketing shell), so the
        // macOS↔Linux font-drift allowance applies to all of them — not just
        // landing/pricing. seedConsent removes the banner, so the residual diff
        // is just raster drift, well within tolerance (ENG-1191).
        const screenshotOptions = marketingScreenshotOptions;
        await expect(page).toHaveScreenshot(
          `shell/${screen.name}-${vp.name}.png`,
          screenshotOptions,
        );
      });
    }
  }
});
