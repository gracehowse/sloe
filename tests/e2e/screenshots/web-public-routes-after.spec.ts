/**
 * Visual validation for audit A1 + A2 fix — captures /dmca, /licences,
 * /whats-new at desktop + mobile viewports to confirm they render the
 * actual page content (not the /login redirect).
 *
 * Output: `apps/mobile/screenshots/latest/after-A1-{vp}-{name}.png`
 */
import { devices, expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "apps/mobile/screenshots/latest");
mkdirSync(OUTPUT_DIR, { recursive: true });

const ROUTES = [
  { path: "/dmca", name: "dmca" },
  { path: "/licences", name: "licences" },
  { path: "/whats-new", name: "whats-new" },
];

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", ...devices["iPhone 13"].viewport, deviceScaleFactor: 2 },
];

for (const vp of VIEWPORTS) {
  test.describe(`A1 visual validation — ${vp.tag}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const r of ROUTES) {
      test(`${r.path} renders content, not /login (${vp.tag})`, async ({ page }) => {
        const response = await page.goto(r.path, { waitUntil: "domcontentloaded", timeout: 20_000 });
        expect(response?.status() ?? 0).toBe(200);
        // /login form has a "Welcome back" or "Create your account" heading;
        // the public page should have neither.
        await page.waitForTimeout(400);
        const url = page.url();
        expect(url).not.toContain("/login");
        await page.screenshot({
          path: join(OUTPUT_DIR, `after-A1-${vp.tag}-${r.name}.png`),
          fullPage: false,
        });
      });
    }
  });
}
