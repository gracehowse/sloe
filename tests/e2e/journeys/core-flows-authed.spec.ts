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
    await expect(page.getByRole("heading", { name: /^Meals$/i })).toBeVisible();
    await expect(
      page.locator('[data-testid="today-hero-desktop"] [data-testid="today-macro-rings-toggle"]'),
    ).toBeVisible();
  });

  test("can navigate between tabs", async ({ page }) => {
    const nav = (name: RegExp) =>
      page.getByRole("tab", { name }).or(page.getByRole("button", { name }));
    await nav(/recipes|discover/i).first().click({ force: true });
    await expect(page.getByRole("heading", { name: /^Discover$/i }).first()).toBeVisible();
    await nav(/plan/i).first().click({ force: true });
    await expect(page.getByRole("heading", { name: /Meal plan(?:ner)?/i })).toBeVisible();
    await nav(/progress/i).first().click({ force: true });
    await expect(page.getByRole("heading", { name: /Progress/i }).first()).toBeVisible();
    await nav(/today/i).first().click({ force: true });
    await expect(page.getByRole("heading", { name: /^Meals$/i })).toBeVisible();
  });

  test("Settings page shows notification labels correctly", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("newRecipes");
    expect(pageText).not.toContain("mealReminders");
  });

  test("recipe import page accepts a URL", async ({ page }) => {
    await page.goto("/import", { waitUntil: "domcontentloaded" });
    const urlInput = page
      .getByPlaceholder(/paste a recipe url/i)
      .or(page.getByPlaceholder(/https:\/\/example\.com\/recipe/i))
      .or(page.getByPlaceholder(/paste a (recipe )?link/i));
    await expect(urlInput.first()).toBeVisible();
  });
});
