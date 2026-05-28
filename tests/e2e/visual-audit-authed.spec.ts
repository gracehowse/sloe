import { test, expect } from "@playwright/test";
import { hasE2ECredentials } from "./utils/auth";
import { dismissVisualOverlays, stabilizeForScreenshot } from "./utils/visual";

const authedScreens = [
  { name: "today", path: "/today" },
  { name: "discover", path: "/discover" },
  { name: "progress", path: "/progress" },
  { name: "plan", path: "/plan" },
  { name: "settings", path: "/settings" },
  { name: "shopping", path: "/shopping" },
  { name: "library", path: "/library" },
] as const;

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("Visual regression — authenticated tabs", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD for authed visual regression.");
  });

  for (const screen of authedScreens) {
    for (const vp of viewports) {
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
