import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../utils/a11y";
import { hasE2ECredentials, loginWithTestUser } from "../utils/auth";

/**
 * QA matrix: in-app `view` query values (see navigateToView in App.tsx).
 * Requires E2E_EMAIL + E2E_PASSWORD and a fully onboarded Supabase profile.
 */
test.describe("Authenticated app view matrix", () => {
  test.beforeEach(({ page }) => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run authenticated journeys.");
  });

  test("when signed in I can open each main view and see the expected shell", async ({ page }) => {
    await loginWithTestUser(page);

    await test.step("Discover", async () => {
      await page.goto("/?view=discover");
      await expect(page.getByRole("heading", { name: /^Platemate$/i }).first()).toBeVisible();
      await expect(page.getByPlaceholder("Search")).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Library", async () => {
      await page.goto("/?view=library");
      await expect(page.getByRole("heading", { name: /^Library$/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Meal planner", async () => {
      await page.goto("/?view=planner");
      await expect(page.getByRole("heading", { name: /AI Meal Planner/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Nutrition tracker", async () => {
      await page.goto("/?view=tracker");
      await expect(page.getByRole("heading", { name: /Nutrition Tracker/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /add meal/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Shopping list", async () => {
      await page.goto("/?view=shopping");
      await expect(page.getByRole("heading", { name: /Shopping List/i }).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Settings", async () => {
      await page.goto("/?view=settings");
      await expect(page.getByRole("heading", { name: /^Settings$/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /privacy policy/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Profile", async () => {
      await page.goto("/?view=profile");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await expect(page.getByText(/\b(free|base|pro) Plan\b/i)).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Create recipe (upload) — Pro upsell or creator", async () => {
      await page.goto("/?view=upload");
      await expect(
        page.getByRole("heading", { name: /Recipe Creator|Create Recipe/i }).first(),
      ).toBeVisible();
      const upgrade = page.getByRole("button", { name: /upgrade to pro/i });
      const importHeading = page.getByRole("heading", { name: /Import from URL/i });
      if (await upgrade.isVisible().catch(() => false)) {
        await expect(upgrade).toBeVisible();
      } else {
        await expect(importHeading).toBeVisible();
      }
      await expectNoSeriousA11yViolations(page);
    });
  });
});
