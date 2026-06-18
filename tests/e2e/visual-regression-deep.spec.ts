import { test, expect } from "@playwright/test";
import { hasVisualGoldenCredentials } from "./utils/auth";
import { dismissVisualOverlays, freezeVisualClock, stabilizeForScreenshot } from "./utils/visual";
import { visualViewports } from "./fixtures/visualViewports";

/** Default discover seed recipe — override with E2E_RECIPE_ID in .env.local. */
const E2E_RECIPE_ID =
  process.env.E2E_RECIPE_ID?.trim() || "seed-v2-mediterranean-greek-salad";

test.describe("Visual regression — deep authenticated routes", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasVisualGoldenCredentials(),
      "Set E2E_VISUAL_EMAIL and E2E_VISUAL_PASSWORD for deterministic deep route snapshots.",
    );
    await freezeVisualClock(page);
  });

  for (const vp of visualViewports) {
    test(`settings preferences band ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/settings", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      const fastingLink = page.getByTestId("settings-fasting-link");
      await fastingLink.scrollIntoViewIfNeeded();
      await stabilizeForScreenshot(page, 1500);
      await expect(page).toHaveScreenshot(`deep/settings-preferences-${vp.name}.png`);
    });

    test(`targets view ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/home?view=targets", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      await expect(page.getByTestId("targets-how-is-this-calculated")).toBeVisible({
        timeout: 30_000,
      });
      await stabilizeForScreenshot(page);
      await expect(page).toHaveScreenshot(`deep/targets-${vp.name}.png`);
    });

    test(`profile targets tab ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/profile", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      await page.getByRole("button", { name: /macro calculator/i }).click();
      await stabilizeForScreenshot(page);
      await expect(page).toHaveScreenshot(`deep/profile-targets-tab-${vp.name}.png`);
    });

    test(`recipe detail ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/discover?recipe=${encodeURIComponent(E2E_RECIPE_ID)}`, {
        waitUntil: "domcontentloaded",
      });
      await dismissVisualOverlays(page);
      await expect(page.getByTestId("recipe-body-title")).toBeVisible({ timeout: 30_000 });
      await stabilizeForScreenshot(page, 3000);
      await expect(page).toHaveScreenshot(`deep/recipe-detail-${vp.name}.png`);
    });

    test(`upgrade paywall dialog ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/profile", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      const upgrade = page.getByRole("button", { name: /upgrade to pro/i });
      const hasUpgrade = await upgrade.isVisible({ timeout: 5000 }).catch(() => false);
      test.skip(!hasUpgrade, "Free/Base upgrade row not visible — user may already be Pro.");
      await upgrade.click();
      await expect(page.locator("#upgrade-paywall-title")).toBeVisible({ timeout: 15_000 });
      await stabilizeForScreenshot(page, 1500);
      await expect(page).toHaveScreenshot(`deep/paywall-dialog-${vp.name}.png`, {
        mask: [page.locator('[class*="animate-pulse"]')],
      });
    });
  }
});
