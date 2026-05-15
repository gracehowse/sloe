/**
 * 2026-05-15 (premium-sweep-v2 S0 prep) — light-mode mirror of
 * `premium-bar-sweep-dark.spec.ts`. The existing dark sweep gives
 * dark-mode pixel coverage on web; the audit retro
 * (`docs/decisions/2026-05-14-premium-audit-sweep-retro.md`) calls
 * for visual-validate per item against the prior state. Without a
 * light-mode capture set the auditor under-flags light-mode
 * regressions on web — the documented Risk #1 in the sweep plan
 * (`/Users/graceturner/.claude/plans/scope-is-the-entire-replicated-shore.md`).
 *
 * Route set, viewports, and capture posture mirror the dark spec
 * exactly so light/dark diffs are apples-to-apples per surface.
 * Output filename pattern: `web-{viewport}-light-{route}.png`.
 */
import { test, expect, devices } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(process.cwd(), "apps/mobile/screenshots/latest");

mkdirSync(OUTPUT_DIR, { recursive: true });

const PUBLIC_ROUTES: Array<{ path: string; name: string }> = [
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

const AUTHED_ROUTES: Array<{ path: string; name: string }> = [
  { path: "/home", name: "home" },
  { path: "/fasting", name: "fasting" },
  { path: "/account/billing", name: "account-billing" },
  { path: "/onboarding", name: "onboarding" },
];

const DEV_ROUTES: Array<{ path: string; name: string }> = [
  { path: "/dev/primitives", name: "dev-primitives" },
];

const ALL_ROUTES = [...PUBLIC_ROUTES, ...AUTHED_ROUTES, ...DEV_ROUTES];

const VIEWPORTS = [
  { tag: "desktop", width: 1440, height: 900 },
  { tag: "mobile", ...devices["iPhone 13"].viewport, deviceScaleFactor: 2 },
];

for (const vp of VIEWPORTS) {
  test.describe(`premium-bar light sweep — ${vp.tag}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: "light",
    });

    for (const route of ALL_ROUTES) {
      test(`captures ${route.path} light (${vp.tag})`, async ({ page }) => {
        const filename = `web-${vp.tag}-light-${route.name}.png`;
        const target = join(OUTPUT_DIR, filename);

        let response = await page.goto(route.path, {
          waitUntil: "networkidle",
          timeout: 30_000,
        });
        if (response?.status() === 404) {
          response = await page.goto(route.path, {
            waitUntil: "networkidle",
            timeout: 30_000,
          });
        }
        expect([200, 301, 302, 304, 307, 308]).toContain(response?.status() ?? 0);

        await page.waitForTimeout(400);

        await page.screenshot({ path: target, fullPage: false });
      });
    }
  });
}
