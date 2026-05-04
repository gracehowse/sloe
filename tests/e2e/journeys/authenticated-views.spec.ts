import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../utils/a11y";
import { hasE2ECredentials, loginWithTestUser } from "../utils/auth";

/**
 * QA matrix: in-app `view` query values (see navigateToView in App.tsx).
 * Requires E2E_EMAIL + E2E_PASSWORD and a fully onboarded Supabase profile.
 */
test.describe("Authenticated app view matrix", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run authenticated journeys.");
  });

  test("when signed in I can open each main view and see the expected shell", async ({ page }) => {
    await loginWithTestUser(page);

    // Dismiss cookie consent banner if visible
    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }

    await test.step("Discover", async () => {
      await page.goto("/?view=discover");
      await expect(page.getByRole("heading", { name: /^Suppr$/i }).first()).toBeVisible();
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
      // Heading copy: the web MealPlanner h1 was renamed from
      // "Meal planner" → "Meal plan" in the 2026-04-20 prototype-port
      // parity work (matches mobile). Accept either token so this
      // assertion is resilient if the copy lands back on
      // "Meal planner" in a future batch.
      await expect(page.getByRole("heading", { name: /Meal plan(?:ner)?/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("Nutrition tracker", async () => {
      await page.goto("/?view=tracker");
      await expect(page.getByRole("tab", { name: /^Today$/i })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("heading", { name: /^Meals$/i })).toBeVisible();
      await expect(
        page.getByText(/Click (the )?ring to (show|hide) macros|Tap for macro breakdown|Showing macro breakdown/i),
      ).toBeVisible();
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
      await expect(page.getByText(/\b(Free|Base|Pro)\b.*Joined/i)).toBeVisible();
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
