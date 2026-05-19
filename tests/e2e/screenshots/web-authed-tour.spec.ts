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
 *
 * 2026-05-17 (Phase 1.1 of UI elevation plan): refactored to use the
 * shared `signInFlow` helper. Cookie consent is suppressed via init
 * script BEFORE navigation (the previous attempt to dismiss the banner
 * AFTER sign-in failed because the bottom-pinned `z-50` strip
 * intercepted the submit button on the iPhone-13 viewport).
 */
import { devices, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { hasE2ECredentials, signInFlow } from "../utils/auth";

async function loginPermissive(page: import("@playwright/test").Page): Promise<void> {
  // Per repo memory (CLAUDE.md visual-elevation rails): the cookie-
  // consent suppression and `.last()` "Sign in" selector live in the
  // shared `signInFlow` helper at tests/e2e/utils/auth.ts. Do NOT
  // duplicate the flow per-spec.
  await signInFlow(page);
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
}

/**
 * Dismiss any blocking overlay (milestone modal, post-onboarding toast,
 * weekly check-in, "what's new" banner). Runs after every navigation
 * so captures aren't blocked. The selectors are intentionally
 * permissive — any button with text in the dismissal set, plus the
 * Radix Dialog close button (X icon with aria-label).
 */
async function dismissOverlays(page: import("@playwright/test").Page): Promise<void> {
  // 1) Dialog close buttons (Radix renders `<button aria-label="Close">`).
  const closes = page.getByRole("button", { name: /^close$/i });
  const closeCount = await closes.count().catch(() => 0);
  for (let i = 0; i < closeCount; i += 1) {
    await closes.nth(i).click({ timeout: 800 }).catch(() => undefined);
  }
  // 2) Dismiss-text buttons (Keep going, Got it, Continue, Maybe later, Dismiss).
  const dismisses = page.getByRole("button", { name: /^(keep going|got it|continue|maybe later|dismiss|skip|not now|later|done)$/i });
  const dismissCount = await dismisses.count().catch(() => 0);
  for (let i = 0; i < dismissCount; i += 1) {
    if (await dismisses.nth(i).isVisible({ timeout: 300 }).catch(() => false)) {
      await dismisses.nth(i).click({ timeout: 800 }).catch(() => undefined);
    }
  }
  // 3) Toast region — Sonner uses aria-label="Notifications" and the
  //    toasts auto-dismiss but linger ~4s. A short wait lets them slide
  //    out before the screenshot fires.
  await page.waitForTimeout(400);
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

/**
 * Authed routes & in-app views to capture in order.
 *
 * 2026-05-17: switched from legacy `/?view=X` aliases to canonical
 * dedicated routes. The root `/` is the marketing landing — it does
 * not honour `?view=` query strings, so the old list captured the
 * landing page 6 times. The SPA shell lives at `/today`, `/discover`,
 * `/library`, `/planner`, `/shopping`, `/recipes`, `/plan`, `/progress`,
 * `/settings`. Each is reachable directly.
 */
const SURFACES: Array<{ name: string; goto: string; settle?: number }> = [
  { name: "today", goto: "/today" },
  { name: "discover", goto: "/discover" },
  { name: "library", goto: "/library" },
  { name: "planner", goto: "/planner" },
  { name: "plan", goto: "/plan" },
  { name: "shopping", goto: "/shopping" },
  { name: "recipes", goto: "/recipes" },
  { name: "progress", goto: "/progress" },
  { name: "settings", goto: "/settings" },
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

      for (const surface of SURFACES) {
        await test.step(`capture ${surface.name}`, async () => {
          await page
            .goto(surface.goto, { waitUntil: "domcontentloaded", timeout: 20_000 })
            .catch(() => undefined);
          // Wait for the splash to go away — the HomeProfileGate / auth
          // gate renders an "S" icon + 3 loading dots until the profile
          // fetch resolves. Then settle web fonts + above-the-fold
          // images. A bare 500ms was capturing the splash itself.
          await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
          await page
            .waitForLoadState("networkidle", { timeout: 6_000 })
            .catch(() => undefined);
          await page.waitForTimeout(surface.settle ?? 1_200);
          await dismissOverlays(page);
          await page.screenshot({
            path: join(OUTPUT_DIR, `web-${vp.tag}-authed-${surface.name}.png`),
            fullPage: false,
          });
        });
      }
    });
  });
}
