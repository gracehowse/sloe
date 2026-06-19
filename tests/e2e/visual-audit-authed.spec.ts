import { test, expect } from "@playwright/test";
import { hasVisualGoldenCredentials } from "./utils/auth";
import { visualAuthFileForBaseUrl } from "./utils/authHosts";
import {
  dismissVisualOverlays,
  forceRedesignVisualFlagsOn,
  freezeVisualClock,
  stabilizeForScreenshot,
} from "./utils/visual";

/** ENG-1142 cohesion gate — Today is one of three gated surfaces (see
 *  `docs/decisions/2026-06-18-visual-regression-posture.md`). Run only
 *  cohesion snapshots: `npm run test:e2e:visual:cohesion`. */

const visualStorageState = hasVisualGoldenCredentials()
  ? visualAuthFileForBaseUrl(
      process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    )
  : undefined;

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
  test.use({ storageState: visualStorageState });
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasVisualGoldenCredentials(),
      "Set E2E_VISUAL_EMAIL and E2E_VISUAL_PASSWORD for deterministic authed visual regression.",
    );
    await forceRedesignVisualFlagsOn(page);
    await freezeVisualClock(page);
  });

  for (const screen of authedScreens) {
    for (const vp of viewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page);
        await expect(page).toHaveScreenshot(
          `tabs/${screen.name}-${vp.name}.png`,
        );
      });
    }
  }
});
