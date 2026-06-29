import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../utils/a11y";
import { hasE2ECredentials } from "../utils/auth";

/**
 * QA matrix: in-app `view` query values (see navigateToView in App.tsx).
 * Requires E2E_EMAIL + E2E_PASSWORD and a fully onboarded Supabase profile.
 */
test.describe("Authenticated app view matrix", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run authenticated journeys.");
  });

  test("when signed in I can open each main view and see the expected shell", async ({ page }) => {
    test.setTimeout(120_000);
    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }

    const gotoView = (path: string) => page.goto(path, { waitUntil: "domcontentloaded" });

    await test.step("Discover", async () => {
      await gotoView("/discover");
      await expect(page.getByRole("heading", { name: /^Discover$/i }).first()).toBeVisible();
      await expect(page.getByPlaceholder(/search recipes/i)).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Library", async () => {
      await gotoView("/library");
      // Empty library redirects to Discover (parity with mobile).
      const libraryTitle = page.getByTestId("library-desktop-title");
      if (await libraryTitle.isVisible({ timeout: 5000 }).catch(() => false)) {
        // ENG-921 / Figma 527:2 — Library search placeholder is
        // "Search your recipes" (Discover keeps "Search recipes").
        await expect(page.getByPlaceholder(/search (your )?recipes/i).first()).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: /^Discover$/i }).first()).toBeVisible();
      }
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Meal planner", async () => {
      await page.goto("/plan");
      // Heading copy: the web MealPlanner h1 was renamed from
      // "Meal planner" → "Meal plan" in the 2026-04-20 prototype-port
      // parity work (matches mobile). Accept either token so this
      // assertion is resilient if the copy lands back on
      // "Meal planner" in a future batch.
      await expect(page.getByRole("heading", { name: /Meal plan(?:ner)?/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Nutrition tracker", async () => {
      await gotoView("/today");
      const todayNav = page
        .getByRole("tab", { name: /^Today$/i })
        .or(page.getByRole("button", { name: /^Today$/i }));
      await expect(todayNav.first()).toBeVisible();
      // Sloe redesign renamed the meals section heading "Meals" → "Today's Meals".
      await expect(page.getByRole("heading", { name: /Today's Meals/i })).toBeVisible();
      await expect(
        page.locator('[data-testid="today-hero-desktop"] [data-testid="today-macro-rings-toggle"]'),
      ).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Shopping list", async () => {
      await gotoView("/shopping");
      await expect(page.getByRole("heading", { name: /Shopping list/i }).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Settings", async () => {
      await gotoView("/settings");
      await expect(page.getByRole("heading", { name: /^Settings$/i })).toBeVisible();
      // Sloe v3 (`sloe_v3_settings`, default-on) re-lays Settings as a
      // two-pane shell: at md+ only the active section's panel renders, and
      // the privacy-policy link lives in the "Privacy & data" section
      // (id: "privacy"), NOT the default-selected "Account & billing" pane.
      // Select that pane first so the link is reachable. The nav is present
      // only in the two-pane shell (`settings-pane-nav-privacy`); the legacy
      // single-scroll flag-off path renders every section at once, so guard
      // the click. The test still verifies the privacy link is reachable in
      // Settings either way.
      const privacyNav = page.getByTestId("settings-pane-nav-privacy");
      if (await privacyNav.isVisible({ timeout: 5000 }).catch(() => false)) {
        await privacyNav.click();
      }
      await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Profile", async () => {
      await gotoView("/profile");
      await expect(page.getByRole("heading", { name: /^More$/i })).toBeVisible();
      await expect(page.getByText(/\b(Free|Pro)\b/i).first()).toBeVisible();
      await expect(page.getByText(/Joined/i).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Create recipe", async () => {
      await gotoView("/create");
      await expect(page.getByRole("heading", { name: /^Create recipe$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /Import instead/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Import recipe", async () => {
      await gotoView("/import");
      await expect(page.getByRole("heading", { name: /^Import recipe$/i })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Paste a recipe link/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });
});
