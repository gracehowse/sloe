import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasE2ECredentials, loginWithTestUser } from "../utils/auth";

/**
 * Create recipe — bulk paste + verify (mocked API so CI does not need USDA keys).
 */
test.describe("Recipe create — paste ingredient list", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run authenticated journeys.");
  });

  test("when I paste lines and match, ingredient rows show parsed names", async ({ page }) => {
    const fixturePath = join(process.cwd(), "tests/e2e/fixtures/verify-recipe-paste-two-lines.json");
    const fixtureBody = readFileSync(fixturePath, "utf8");

    await page.route("**/api/nutrition/verify-recipe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: fixtureBody,
      });
    });

    await loginWithTestUser(page);

    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }

    await page.goto("/?view=upload");
    await expect(
      page.getByRole("heading", { name: /Recipe Creator|Create Recipe/i }).first(),
    ).toBeVisible({ timeout: 25_000 });

    await page.getByRole("button", { name: /Paste ingredient list/i }).click();
    await expect(page.getByRole("heading", { name: /Paste ingredient list/i })).toBeVisible();

    const box = page.getByRole("dialog").getByRole("textbox");
    await box.fill("1 cup flour\n2 eggs");
    await page.getByRole("button", { name: /Match to database/i }).click();

    await expect(page.getByText(/flour/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/eggs/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
