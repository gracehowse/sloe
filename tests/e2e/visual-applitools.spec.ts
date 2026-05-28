import { test } from "@playwright/test";
import { Target } from "@applitools/eyes-playwright";
import { createEyes, hasApplitoolsApiKey } from "./utils/applitools";
import { dismissVisualOverlays, stabilizeForScreenshot } from "./utils/visual";

/**
 * Optional hosted visual AI diff (Applitools Eyes).
 * Runs only when APPLITOOLS_API_KEY is set — complements in-repo Playwright snapshots.
 * Review results in the Applitools dashboard; do not commit Eyes baselines to git.
 */
const publicScreens = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login" },
  { name: "pricing", path: "/pricing" },
  { name: "today", path: "/today" },
  { name: "discover", path: "/discover" },
] as const;

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

test.describe("Applitools Eyes — public shell (optional)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    test.skip(
      !hasApplitoolsApiKey(),
      "Set APPLITOOLS_API_KEY to run Applitools Eyes checks (see docs/testing/VISUAL_REGRESSION.md).",
    );
  });

  for (const screen of publicScreens) {
    for (const vp of viewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        const eyes = createEyes(`public/${screen.name}-${vp.name}`);
        try {
          await eyes.open(page, undefined, undefined, {
            width: vp.width,
            height: vp.height,
          });
          await page.goto(screen.path, { waitUntil: "domcontentloaded" });
          await dismissVisualOverlays(page);
          await stabilizeForScreenshot(page, screen.name === "landing" ? 3000 : 2500);
          await eyes.check({
            tag: `${screen.name}-${vp.name}`,
            target: Target.window().fully(),
          });
        } finally {
          await eyes.close(false);
        }
      });
    }
  }
});
