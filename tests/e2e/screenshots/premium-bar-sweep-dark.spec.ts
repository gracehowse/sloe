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
  test.describe(`premium-bar dark sweep — ${vp.tag}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: "dark",
    });

    for (const route of ALL_ROUTES) {
      test(`captures ${route.path} dark (${vp.tag})`, async ({ page }) => {
        const filename = `web-${vp.tag}-dark-${route.name}.png`;
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
