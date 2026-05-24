import { expect, test } from "@playwright/test";
import { hasE2ECredentials } from "../utils/auth";

/**
 * Cook mode — step body must stay readable on bg-background (regression for white-on-cream).
 */
test.describe("Cook mode", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run cook mode journey.");
  });

  test("when I open cook mode from a recipe, step instructions use foreground text", async ({
    page,
  }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded" });

    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }
    await page.getByPlaceholder(/search recipes/i).waitFor({ state: "visible", timeout: 25_000 });

    const recipeCard = page
      .getByRole("button", { name: /Classic Greek Salad|greek salad/i })
      .or(page.getByRole("link", { name: /greek salad|recipe/i }))
      .first();
    await recipeCard.click({ timeout: 15_000 });

    await page.getByRole("button", { name: /^cook$/i }).click({ timeout: 20_000 });

    const stepText = page.locator(".leading-relaxed.text-foreground").first();
    await expect(stepText).toBeVisible({ timeout: 15_000 });

    const color = await stepText.evaluate((el) => window.getComputedStyle(el).color);
    expect(color).not.toBe("rgb(255, 255, 255)");
  });
});
