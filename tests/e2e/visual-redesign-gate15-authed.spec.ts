/**
 * ENG-827 — Gate 1.5 authenticated cohesion goldens.
 *
 * Log-a-meal sheet (ENG-900) on mobile-web — the MFP-refugee logging loop
 * the viral push sells. Desktop Today opens the sheet differently; mobile-web
 * FAB is the canonical capture path.
 */
import { test, expect } from "@playwright/test";
import { hasVisualGoldenCredentials } from "./utils/auth";
import { dismissVisualOverlays, freezeVisualClock, stabilizeForScreenshot } from "./utils/visual";

test.describe("Visual regression — Gate 1.5 log sheet (ENG-827 / ENG-900)", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasVisualGoldenCredentials(),
      "Set E2E_VISUAL_EMAIL and E2E_VISUAL_PASSWORD for deterministic authed Gate 1.5 snapshots.",
    );
    await freezeVisualClock(page);
  });

  test("log sheet mobile-web", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/today", { waitUntil: "domcontentloaded" });
    await dismissVisualOverlays(page);
    const logFab = page.getByTestId("mobile-web-tab-log-button");
    await expect(logFab).toBeVisible({ timeout: 30_000 });
    await logFab.click();
    await expect(page.getByTestId("log-sheet-search-input")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("log-sheet-input-mode-row")).toBeVisible({
      timeout: 10_000,
    });
    await stabilizeForScreenshot(page, 1500);
    await expect(page).toHaveScreenshot("gate15/log-sheet-mobile-web.png", {
      maxDiffPixelRatio: 0.01,
    });
  });
});
