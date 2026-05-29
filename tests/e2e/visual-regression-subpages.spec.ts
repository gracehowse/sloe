import { test, expect } from "@playwright/test";
import { hasE2ECredentials } from "./utils/auth";
import { dismissVisualOverlays, stabilizeForScreenshot } from "./utils/visual";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/** Marketing / legal / help — no session required. */
const publicSubpageScreenshotOptions = { maxDiffPixelRatio: 0.06 } as const;

const publicSubpages = [
  { name: "help", path: "/help" },
  { name: "whats-new", path: "/whats-new" },
  { name: "fasting", path: "/fasting" },
  { name: "terms", path: "/terms" },
  { name: "privacy", path: "/privacy" },
  { name: "pricing", path: "/pricing" },
] as const;

/** Deep product routes outside the main tab shell. */
const authedSubpages = [
  { name: "profile", path: "/profile" },
  { name: "import", path: "/import" },
  { name: "notifications", path: "/notifications" },
  { name: "account-billing", path: "/account/billing" },
  { name: "create", path: "/create" },
] as const;

test.describe("Visual regression — public subpages", () => {
  test.describe.configure({ mode: "parallel" });

  for (const screen of publicSubpages) {
    for (const vp of viewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page);
        await expect(page).toHaveScreenshot(
          `subpages/public/${screen.name}-${vp.name}.png`,
          publicSubpageScreenshotOptions,
        );
      });
    }
  }
});

test.describe("Visual regression — authenticated subpages", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD for authed subpage snapshots.");
  });

  for (const screen of authedSubpages) {
    for (const vp of viewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page);
        await expect(page).toHaveScreenshot(`subpages/authed/${screen.name}-${vp.name}.png`);
      });
    }
  }
});
