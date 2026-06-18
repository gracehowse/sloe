/**
 * Web authenticated screenshot tour — signs in with E2E_EMAIL / E2E_PASSWORD
 * and captures every signed-in surface (Discover, Library, Planner,
 * Tracker, Shopping, Recipes, Account, Settings) at desktop + mobile
 * viewports.
 *
 * Output: `apps/mobile/screenshots/latest/web-{vp}-authed-{name}.png`
 *
 * Skips if E2E_EMAIL / E2E_PASSWORD are missing (matches behaviour of
 * `tests/e2e/journeys/authenticated-views.spec.ts`).
 */
import { devices, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { hasE2ECredentials, loginWithTestUser } from "../utils/auth";

const OUTPUT_DIR = join(process.cwd(), "apps/mobile/screenshots/latest");
mkdirSync(OUTPUT_DIR, { recursive: true });

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  {
    tag: "mobile",
    ...devices["iPhone 13"].viewport,
    deviceScaleFactor: 2,
  },
];

/** Authed routes & in-app views to capture in order. */
const SURFACES: Array<{ name: string; goto: string; settle?: number }> = [
  { name: "discover", goto: "/?view=discover" },
  { name: "library", goto: "/?view=library" },
  { name: "planner", goto: "/?view=planner" },
  { name: "tracker-today", goto: "/?view=tracker" },
  { name: "shopping", goto: "/?view=shopping" },
  { name: "recipes", goto: "/?view=recipes" },
  { name: "fasting", goto: "/fasting" },
  { name: "account-billing", goto: "/account/billing" },
  { name: "account-profile", goto: "/account/profile" },
  { name: "account-settings", goto: "/account/settings" },
];

for (const vp of VIEWPORTS) {
  test.describe(`web authed tour — ${vp.tag}`, () => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run authed capture.");
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`captures every authenticated surface (${vp.tag})`, async ({ page }) => {
      test.setTimeout(180_000);
      await loginWithTestUser(page);

      // Cookie consent dismissal — the first authed page may show it.
      const acceptBtn = page.getByRole("button", { name: /accept all/i });
      if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptBtn.click().catch(() => undefined);
      }

      for (const surface of SURFACES) {
        await test.step(`capture ${surface.name}`, async () => {
          await page
            .goto(surface.goto, { waitUntil: "domcontentloaded", timeout: 20_000 })
            .catch(() => undefined);
          await page.waitForTimeout(surface.settle ?? 500);
          await page.screenshot({
            path: join(OUTPUT_DIR, `web-${vp.tag}-authed-${surface.name}.png`),
            fullPage: false,
          });
        });
      }
    });
  });
}
