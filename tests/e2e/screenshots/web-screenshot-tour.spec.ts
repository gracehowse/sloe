/**
 * Web screenshot tour — captures every web page at desktop + mobile-web
 * viewports for the 2026-04-30 audit follow-up ("every user journey
 * screenshotted").
 *
 * Output: `apps/mobile/screenshots/latest/web-*.png` so the audit
 * agents can read them via the same path convention as the Maestro
 * mobile captures.
 *
 * Run with `npm run test:e2e -- tests/e2e/screenshots/web-screenshot-tour.spec.ts`.
 *
 * Auth: most authed routes redirect to /signin when no session. The
 * tour captures both pre-auth and post-auth states where relevant.
 * Grace runs this after the dev server is up at PLAYWRIGHT_BASE_URL
 * (defaults to http://127.0.0.1:3000).
 */
import { test, expect, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(
  process.cwd(),
  "apps/mobile/screenshots/latest",
);

mkdirSync(OUTPUT_DIR, { recursive: true });

/** All public web routes — order = nav importance. */
const PUBLIC_ROUTES: Array<{ path: string; name: string; waitFor?: string }> = [
  { path: "/", name: "landing" },
  { path: "/pricing", name: "pricing" },
  { path: "/roadmap", name: "roadmap" },
  { path: "/help", name: "help" },
  { path: "/whats-new", name: "whats-new" },
  { path: "/privacy", name: "privacy" },
  { path: "/terms", name: "terms" },
  { path: "/dmca", name: "dmca" },
  { path: "/licences", name: "licences" },
  { path: "/login", name: "login" },
  { path: "/signin", name: "signin" },
  { path: "/signup", name: "signup" },
  { path: "/reset-password", name: "reset-password" },
];

/** Authed routes — these redirect to /signin without a session, so
 *  we capture them anyway to lock the redirect contract. */
const AUTHED_ROUTES: Array<{ path: string; name: string }> = [
  { path: "/home", name: "home" },
  { path: "/fasting", name: "fasting" },
  { path: "/account/billing", name: "account-billing" },
  { path: "/onboarding", name: "onboarding-legacy" },
  { path: "/onboarding/v2", name: "onboarding-v2" },
];

/** Dev surfaces — useful for design-system sanity. */
const DEV_ROUTES: Array<{ path: string; name: string }> = [
  { path: "/dev/primitives", name: "dev-primitives" },
];

const ALL_ROUTES = [...PUBLIC_ROUTES, ...AUTHED_ROUTES, ...DEV_ROUTES];

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", ...devices["iPhone 13"].viewport, deviceScaleFactor: 2 },
];

for (const vp of VIEWPORTS) {
  test.describe(`web screenshot tour — ${vp.tag}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ALL_ROUTES) {
      test(`captures ${route.path} (${vp.tag})`, async ({ page }) => {
        const filename = `web-${vp.tag}-${route.name}.png`;
        const target = join(OUTPUT_DIR, filename);

        // Navigate; allow up to networkidle so client hydration completes.
        const response = await page.goto(route.path, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });

        // Don't fail the test on auth-redirect 3xx — we still want
        // the rendered destination captured so the audit can see what
        // the user actually sees.
        expect([200, 301, 302, 304, 307, 308]).toContain(response?.status() ?? 0);

        // Brief settle so animations finish before screenshot.
        await page.waitForTimeout(400);

        // Viewport-only (not fullPage) so each PNG fits the agent
        // image dimension limit (≤2000px). Use a separate
        // "fullpage-*" pass for long-page audits where below-the-
        // fold content matters.
        await page.screenshot({
          path: target,
          fullPage: false,
        });
      });
    }
  });
}
