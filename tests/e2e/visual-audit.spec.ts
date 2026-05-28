import { test, expect } from "@playwright/test";
import { dismissVisualOverlays, stabilizeForScreenshot } from "./utils/visual";

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

test.describe("Visual regression — public shell", () => {
  test.describe.configure({ mode: "parallel" });

  for (const screen of screens) {
    for (const vp of viewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page, screen.name === "landing" ? 3000 : 2500);
        await expect(page).toHaveScreenshot(`shell/${screen.name}-${vp.name}.png`);
      });
    }
  }
});
