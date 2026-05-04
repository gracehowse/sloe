/**
 * Bundle 1A — visual validation screenshots.
 *
 * Captures the DailyRing in 4 states (empty, partial, at-goal, over)
 * and the TodayHeroStats NET tile in 4 states (empty, under, at-goal,
 * over) for B6 / N3 / N4 / N5 verification.
 *
 * Output: docs/screenshots/launch-bugs/bundle-1a-after/*.png
 *
 * Run with:
 *   npm run test:e2e -- tests/e2e/screenshots/bundle-1a-validation.spec.ts
 */
import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "docs/screenshots/launch-bugs/bundle-1a-after");
mkdirSync(OUTPUT_DIR, { recursive: true });

test.describe("Bundle 1A visual validation", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("captures DailyRing 4 states + NET tile 4 states", async ({ page }) => {
    await page.goto("/dev/daily-ring-states", { waitUntil: "networkidle" });

    // Full-page screenshot for the all-up view
    await page.screenshot({
      path: join(OUTPUT_DIR, "all-states-fullpage.png"),
      fullPage: true,
    });

    // Per-state DailyRing screenshots
    for (const stateId of ["empty", "partial", "at-goal", "over"]) {
      const el = page.getByTestId(`state-${stateId}`);
      await el.screenshot({ path: join(OUTPUT_DIR, `daily-ring-${stateId}.png`) });
    }

    // Per-state NET tile screenshots
    for (const stateId of ["empty", "under", "at-goal", "over"]) {
      const el = page.getByTestId(`hero-${stateId}`);
      await el.screenshot({ path: join(OUTPUT_DIR, `hero-net-${stateId}.png`) });
    }
  });
});
