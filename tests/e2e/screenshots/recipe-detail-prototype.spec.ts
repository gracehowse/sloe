/**
 * Capture the recipe-detail BEFORE/AFTER prototype as PNGs.
 * Output: apps/mobile/screenshots/latest/recipe-detail-prototype-{overview,before,after}.png
 */
import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "apps/mobile/screenshots/latest");
mkdirSync(OUTPUT_DIR, { recursive: true });

test.describe("recipe detail prototype", () => {
  test.use({ viewport: { width: 1100, height: 1100 } });

  test("captures overview at 1100w", async ({ page }) => {
    await page.goto("/dev/recipe-detail-redesign", { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(800);
    await page.screenshot({
      path: join(OUTPUT_DIR, "recipe-detail-prototype-overview.png"),
      fullPage: true,
    });
  });
});
