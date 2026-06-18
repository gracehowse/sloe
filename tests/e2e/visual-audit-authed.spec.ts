import { test, expect } from "@playwright/test";
import { hasVisualGoldenCredentials } from "./utils/auth";
import { dismissVisualOverlays, freezeVisualClock, stabilizeForScreenshot } from "./utils/visual";
import { visualViewports } from "./fixtures/visualViewports";

const authedScreens = [
  { name: "today", path: "/today" },
  { name: "discover", path: "/discover" },
  { name: "progress", path: "/progress" },
  { name: "plan", path: "/plan" },
  { name: "settings", path: "/settings" },
  { name: "shopping", path: "/shopping" },
  { name: "library", path: "/library" },
] as const;

test.describe("Visual regression — authenticated tabs", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasVisualGoldenCredentials(),
      "Set E2E_VISUAL_EMAIL and E2E_VISUAL_PASSWORD for deterministic authed visual regression.",
    );
    await freezeVisualClock(page);
  });

  for (const screen of authedScreens) {
    for (const vp of visualViewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page);
        await expect(page).toHaveScreenshot(`tabs/${screen.name}-${vp.name}.png`);
      });
    }
  }
});
