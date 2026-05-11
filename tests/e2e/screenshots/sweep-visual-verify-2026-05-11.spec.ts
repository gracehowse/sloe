/**
 * Visual verification for the 2026-05-11 P0+P1 sweep (PRs #200-#206).
 *
 * Captures screenshots of the surfaces I changed today on the live
 * production deploy so the visual diff is reviewable without spinning
 * up the iOS sim. Mobile-side verification happens via the TF build
 * #48 install + the screenshot_tour Maestro flow.
 *
 * Run with:
 *   PLAYWRIGHT_BASE_URL=https://suppr-club.com \
 *     npx playwright test tests/e2e/screenshots/sweep-visual-verify-2026-05-11.spec.ts
 *
 * Output: `docs/audits/2026-05-11-sweep-screenshots/`
 */
import { devices, expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(
  process.cwd(),
  "docs/audits/2026-05-11-sweep-screenshots",
);
mkdirSync(OUTPUT_DIR, { recursive: true });

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", ...devices["iPhone 13"].viewport, deviceScaleFactor: 2 },
];

for (const vp of VIEWPORTS) {
  test.describe(`Sweep visual verify — ${vp.tag}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    // P0 (PR #200): Onboarding welcome screen — "Example" badge, opacity
    // dim on illustration, "USDA-backed nutrition" present-tense copy.
    test(`onboarding/welcome — illustration is clearly an example (${vp.tag})`, async ({
      page,
    }) => {
      const res = await page.goto("/onboarding", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(res?.status() ?? 0).toBe(200);
      await page.waitForTimeout(800);
      await page.screenshot({
        path: join(OUTPUT_DIR, `onboarding-welcome-${vp.tag}.png`),
        fullPage: true,
      });
    });

    // Landing page — verify nothing regressed (B13 in-repo rebrand was
    // already done; this is a baseline capture).
    test(`landing — baseline (${vp.tag})`, async ({ page }) => {
      const res = await page.goto("/", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(res?.status() ?? 0).toBe(200);
      await page.waitForTimeout(800);
      await page.screenshot({
        path: join(OUTPUT_DIR, `landing-${vp.tag}.png`),
        fullPage: true,
      });
    });

    // /pricing — baseline before B12 region-aware pricing lands.
    test(`pricing — baseline (£ hardcoded today, region-aware deferred to B12) (${vp.tag})`, async ({
      page,
    }) => {
      const res = await page.goto("/pricing", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(res?.status() ?? 0).toBe(200);
      await page.waitForTimeout(800);
      await page.screenshot({
        path: join(OUTPUT_DIR, `pricing-${vp.tag}.png`),
        fullPage: true,
      });
    });
  });
}
