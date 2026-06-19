import { test, expect } from "@playwright/test";
import { hasVisualGoldenCredentials } from "./utils/auth";
import { dismissVisualOverlays, freezeVisualClock, stabilizeForScreenshot } from "./utils/visual";
import { authedVisualSubpages, visualSubpageViewports } from "./fixtures/visualSubpages";

test.describe("Visual regression — authenticated subpages", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasVisualGoldenCredentials(),
      "Set E2E_VISUAL_EMAIL and E2E_VISUAL_PASSWORD for deterministic authed subpage snapshots.",
    );
    await freezeVisualClock(page);
  });

  for (const screen of authedVisualSubpages) {
    for (const vp of visualSubpageViewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        if (screen.path === "/account/billing") {
          // Free-tier users without stripe_customer_id redirect to pricing (P0-1 billing decision).
          await page
            .waitForURL(/\/pricing(\?|$)/, { timeout: 30_000 })
            .catch(() => undefined);
        }
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page);
        await expect(page).toHaveScreenshot(`subpages/authed/${screen.name}-${vp.name}.png`);
      });
    }
  }
});
