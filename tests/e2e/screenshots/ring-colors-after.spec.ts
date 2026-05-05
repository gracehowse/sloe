/**
 * Visual validation for the calorie ring colour-mapping fix
 * (Grace 2026-05-05 audit feedback). Captures the existing
 * `/dev/daily-ring-states` page which renders the ring in 4 states:
 *   - empty / partial (under) / at-goal / over
 *
 * Expected after fix:
 *   - empty:   brand gradient (full opacity in arc, soft in track)
 *   - under:   solid var(--success)
 *   - at-goal: solid var(--success)
 *   - over:    solid var(--destructive) (was: var(--success))
 */
import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "apps/mobile/screenshots/latest");
mkdirSync(OUTPUT_DIR, { recursive: true });

test.describe("ring colour mapping", () => {
test("captures ring states after fix", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/dev/daily-ring-states", { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: join(OUTPUT_DIR, "after-ring-colors-web-states.png"),
    fullPage: true,
  });
});
});
