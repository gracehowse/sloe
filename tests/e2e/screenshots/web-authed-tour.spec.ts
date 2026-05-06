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
import { hasE2ECredentials } from "../utils/auth";

async function loginPermissive(page: import("@playwright/test").Page): Promise<void> {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) throw new Error("E2E creds missing");
  await page.goto("/login", { waitUntil: "networkidle", timeout: 30_000 });
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  await page.getByPlaceholder("you@domain.com").fill(email);
  await page.getByPlaceholder(/your password/i).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).nth(1).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45_000 });
  // Settle — don't assert on a specific heading since the post-login page may
  // be /home, /onboarding, or a milestone modal over Today.
  await page.waitForTimeout(2000);
  // Dismiss any blocking milestone modal if visible.
  const keepGoing = page.getByRole("button", { name: /keep going|continue|got it|close/i }).first();
  if (await keepGoing.isVisible({ timeout: 1500 }).catch(() => false)) {
    await keepGoing.click().catch(() => undefined);
  }
}

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
      await loginPermissive(page);

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
