import { test, expect } from "@playwright/test";
import { hasVisualGoldenCredentials } from "./utils/auth";
import { visualAuthFileForBaseUrl } from "./utils/authHosts";
import {
  dismissVisualOverlays,
  forceRedesignVisualFlagsOn,
  freezeVisualClock,
  stabilizeForScreenshot,
} from "./utils/visual";

/** ENG-1142 cohesion gate — recipe detail + paywall dialog are two of
 *  three gated surfaces (see `docs/decisions/2026-06-18-visual-regression-posture.md`).
 *  Run only cohesion snapshots: `npm run test:e2e:visual:cohesion`. */

const visualStorageState = hasVisualGoldenCredentials()
  ? visualAuthFileForBaseUrl(
      process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    )
  : undefined;

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/** Default discover seed recipe — override with E2E_RECIPE_ID in .env.local. */
const E2E_RECIPE_ID =
  process.env.E2E_RECIPE_ID?.trim() || "seed-v2-mediterranean-butter-bean-shakshuka";

test.describe("Visual regression — deep authenticated routes", () => {
  // ENG-1639 (2026-07-21) — was `mode: "serial"`, with no comment explaining
  // why. Each test below does its own independent page.goto() and loads auth
  // from the same storageState file (Playwright's project-level
  // dependencies: ["setup"] mechanism, playwright.config.ts) — nothing here
  // shares mutable state across tests, so nothing requires sequential
  // execution. Serial mode's real effect was liability, not a requirement:
  // Playwright aborts every LATER test in a serial block the moment one
  // fails. Confirmed twice in one afternoon regenerating baselines for this
  // exact file: a flaky, wholly-unrelated `profile targets tab` click
  // (fixed/retired, #1003) and then `settings preferences band desktop`
  // (`locator.scrollIntoViewIfNeeded` timeout, tracked separately) each took
  // down every test declared after them in the file — including recipe
  // detail and upgrade paywall dialog, the two ENG-1142 cohesion-gate
  // surfaces this file exists to protect. Default (parallel/independent)
  // mode means one broken test reports its own failure and nothing else.
  test.use({ storageState: visualStorageState });
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasVisualGoldenCredentials(),
      "Set E2E_VISUAL_EMAIL and E2E_VISUAL_PASSWORD for deterministic deep route snapshots.",
    );
    await forceRedesignVisualFlagsOn(page);
    await freezeVisualClock(page);
  });

  for (const vp of viewports) {
    test(`settings preferences band ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/settings", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      // sloe_v3_settings (default-on) two-pane shell only shows the active
      // section at md+ (SettingsTwoPaneShell.tsx: non-active panels get
      // `block md:hidden`); "Account & billing" is the default, so the
      // Preferences panel — and settings-fasting-link inside it — stays
      // display:none at desktop until its nav item is clicked. Without this,
      // scrollIntoViewIfNeeded can never bring a display:none element to a
      // stable rect and times out. Mirrors the same guard already used for
      // the privacy nav in authenticated-views.spec.ts. No-ops on mobile,
      // where the nav (`hidden md:block`) isn't rendered at all.
      const preferencesNav = page.getByTestId("settings-pane-nav-preferences");
      if (await preferencesNav.isVisible({ timeout: 2000 }).catch(() => false)) {
        await preferencesNav.click();
      }
      const fastingLink = page.getByTestId("settings-fasting-link");
      await expect(fastingLink).toBeVisible({ timeout: 10_000 });
      await fastingLink.scrollIntoViewIfNeeded();
      await stabilizeForScreenshot(page, 1500);
      await expect(page).toHaveScreenshot(
        `deep/settings-preferences-${vp.name}.png`,
      );
    });

    test(`targets view ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/home?view=targets", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      await expect(
        page.getByTestId("targets-how-is-this-calculated"),
      ).toBeVisible({
        timeout: 30_000,
      });
      await stabilizeForScreenshot(page);
      await expect(page).toHaveScreenshot(`deep/targets-${vp.name}.png`);
    });

    // `profile targets tab` (clicked "Macro Calculator" on /profile) removed
    // 2026-07-21. ENG-1629 (#1001) hit this same failure and landed a
    // `test.skip` stopgap ("remove once the underlying click is fixed") to
    // unblock its own baseline regen — this supersedes that skip with the
    // actual fix: the click can't be fixed because the button is gone for
    // good, not flaky. `sloe_v3_profile` went default-on 2026-07-01
    // (ENG-1246, #686), so Profile.tsx now returns the read-only
    // `EditorialProfileBlock` before ever reaching the legacy Tabs/Macro-
    // Calculator markup — that branch is unreachable in production
    // (`flagForceOverride` is inert when NODE_ENV === "production", so no
    // real user or query-param override can reach it). Default `/profile`
    // render is already covered by `visual-regression-subpages.spec.ts`;
    // target editing is covered by the `targets view` test above
    // (`/home?view=targets`) and Targets.tsx's own `GoalPaceEditorDialog`.

    test(`recipe detail ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/discover?recipe=${encodeURIComponent(E2E_RECIPE_ID)}`, {
        waitUntil: "domcontentloaded",
      });
      await dismissVisualOverlays(page);
      // Re-pinned 2026-07-21 (ENG-1629 discovery) -- this hardcoded
      // `recipe-body-title` alone since before `recipe_detail_v3_conformance`
      // went default-on (ENG-1247, 2026-06-29). RecipeDetail.tsx's own
      // `heroOverlayActive` (recipeDetailV3 && heroHasPhoto) hides that body
      // `<h1>` in favour of `recipe-hero-overlay-title` whenever the recipe
      // has a photo -- an existing, correct product variation, not a bug.
      // Whichever one is live is the real readiness signal for "the title
      // rendered"; hardcoding just one made this test flake/fail entirely
      // based on whether the seeded golden recipe happens to have a photo.
      await expect(
        page.locator(
          '[data-testid="recipe-body-title"], [data-testid="recipe-hero-overlay-title"]',
        ),
      ).toBeVisible({
        timeout: 30_000,
      });
      await stabilizeForScreenshot(page, 3000);
      await expect(page).toHaveScreenshot(`deep/recipe-detail-${vp.name}.png`);
    });

    test(`upgrade paywall dialog ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/profile", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      const upgrade = page.getByRole("button", { name: /upgrade to pro/i });
      const hasUpgrade = await upgrade
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      test.skip(
        !hasUpgrade,
        "Free/Base upgrade row not visible — user may already be Pro.",
      );
      await upgrade.click();
      await expect(page.locator("#upgrade-paywall-title")).toBeVisible({
        timeout: 15_000,
      });
      await stabilizeForScreenshot(page, 1500);
      await expect(page).toHaveScreenshot(
        `deep/paywall-dialog-${vp.name}.png`,
        {
          mask: [page.locator('[class*="animate-pulse"]')],
        },
      );
    });
  }
});
