/**
 * Bundle 1B — visual validation screenshots (web).
 *
 * Captures the dev page at `/dev/health-import-labels` showing:
 *   - old vs new fallback format
 *   - sample Recents list before + after the predicate filter
 *
 * Output: docs/screenshots/launch-bugs/bundle-1b-after/*.png
 */
import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "docs/screenshots/launch-bugs/bundle-1b-after");
mkdirSync(OUTPUT_DIR, { recursive: true });

test.describe("Bundle 1B visual validation", () => {
  test.use({ viewport: { width: 1024, height: 1400 } });

  test("captures format comparison + filtered/unfiltered Recents", async ({ page }) => {
    await page.goto("/dev/health-import-labels", { waitUntil: "networkidle" });

    await page.screenshot({
      path: join(OUTPUT_DIR, "all-states-fullpage.png"),
      fullPage: true,
    });

    for (const id of ["format-comparison", "recents-unfiltered", "recents-filtered"]) {
      const el = page.getByTestId(id);
      await el.screenshot({ path: join(OUTPUT_DIR, `${id}.png`) });
    }
  });
});
