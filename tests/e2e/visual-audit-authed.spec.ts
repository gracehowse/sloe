import { test } from "@playwright/test";
import { hasE2ECredentials } from "./utils/auth";

/**
 * Authenticated visual capture — product tabs require a session.
 * Unauthenticated `visual-audit.spec.ts` only captures login redirects for /today etc.
 */
const authedScreens = [
  { name: "today", path: "/today" },
  { name: "discover", path: "/discover" },
  { name: "progress", path: "/progress" },
  { name: "plan", path: "/plan" },
  { name: "settings", path: "/settings" },
  { name: "shopping", path: "/shopping" },
  { name: "library", path: "/library" },
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
];

test.describe("Visual audit (authenticated)", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD for authed visual audit.");
  });

  for (const screen of authedScreens) {
    for (const vp of viewports) {
      test(`visual-audit-authed ${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2500);
        await page.screenshot({
          path: `screenshots/visual-audit/${screen.name}-${vp.name}-authed.png`,
          fullPage: false,
        });
      });
    }
  }
});
