import { expect, test } from "@playwright/test";
import { hasE2ECredentials } from "../utils/auth";

/**
 * Authenticated core journeys — uses `chromium-authed` storage state (see auth.setup.ts).
 */
test.describe("Authenticated flows", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "E2E_EMAIL and E2E_PASSWORD required");
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/today", { waitUntil: "domcontentloaded" });
    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }
  });

  test("Today view shows calorie ring and macro cards", async ({ page }) => {
    const todayNav = page
      .getByRole("tab", { name: /today/i })
      .or(page.getByRole("button", { name: /today/i }));
    await expect(todayNav.first()).toBeVisible();
    // Sloe redesign renamed the meals section heading "Meals" → "Today's Meals".
    await expect(page.getByRole("heading", { name: /Today's Meals/i })).toBeVisible();
    await expect(
      page.locator('[data-testid="today-hero-desktop"] [data-testid="today-macro-rings-toggle"]'),
    ).toBeVisible();
  });

  test("can navigate between tabs", async ({ page }) => {
    const nav = (name: RegExp) =>
      page.getByRole("tab", { name }).or(page.getByRole("button", { name }));
    await nav(/recipes|discover/i).first().click({ force: true });
    // The "Recipes" sidebar nav lands on /library when the account has saved
    // recipes (heading "Library") and on /discover when it's empty (heading
    // "Discover"). Both are the recipes surface — accept either.
    await expect(page.getByRole("heading", { name: /^(Library|Discover)$/i }).first()).toBeVisible();
    await nav(/plan/i).first().click({ force: true });
    await expect(page.getByRole("heading", { name: /Meal plan(?:ner)?/i })).toBeVisible();
    await nav(/progress/i).first().click({ force: true });
    await expect(page.getByRole("heading", { name: /Progress/i }).first()).toBeVisible();
    await nav(/today/i).first().click({ force: true });
    await expect(page.getByRole("heading", { name: /Today's Meals/i })).toBeVisible();
  });

  test("Settings page shows notification labels correctly", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("newRecipes");
    expect(pageText).not.toContain("mealReminders");
  });

  test("recipe import page accepts a URL", async ({ page }) => {
    await page.goto("/import", { waitUntil: "domcontentloaded" });
    // Sloe redesign: the "Paste a recipe link" card holds a `type="url"`
    // input with a placeholder of just "https://…" (RecipeUpload.tsx). Target
    // the url-type input — the intent is "the import URL field is present and
    // typeable".
    await expect(page.getByRole("heading", { name: /Paste a recipe link/i })).toBeVisible();
    const urlInput = page.locator('input[type="url"]').first();
    await expect(urlInput).toBeVisible();
    await urlInput.fill("https://example.com/recipe");
    await expect(urlInput).toHaveValue("https://example.com/recipe");
  });
});
