import { expect, test } from "@playwright/test";

/**
 * Core user journeys — these test real browser interaction.
 * Requires:
 *   - E2E_EMAIL and E2E_PASSWORD env vars for authenticated tests
 *   - Dev server running at PLAYWRIGHT_BASE_URL
 */

test.describe("Public pages", () => {
  test("help page loads with methodology section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: /help & information/i })).toBeVisible();
    await expect(page.getByText(/mifflin-st jeor/i)).toBeVisible();
    await expect(page.getByText(/usda fooddata central/i).first()).toBeVisible();
    await expect(page.getByText(/not medical advice/i)).toBeVisible();
  });

  test("privacy page loads with retention section", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByText(/data retention/i)).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: /delete your account/i })).toBeVisible();
  });

  test("terms page loads with eligibility section", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByText(/13 years old/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Subscriptions$/ })).toBeVisible();
  });

  test("pricing page loads and shows tiers", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });

  test("unauthenticated root redirects to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login**");
    await expect(page.getByPlaceholder("you@domain.com")).toBeVisible();
  });
});

test.describe("Authenticated flows", () => {
  // Skip if no E2E credentials
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  test.skip(!email || !password, "E2E_EMAIL and E2E_PASSWORD required");

  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
    await page.getByPlaceholder("you@domain.com").fill(email!);
    await page.getByPlaceholder(/your password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).last().click();
    // Wait for app to load
    await page.waitForURL("/?**");
    await page.waitForTimeout(2000);
  });

  test("Today view shows calorie ring and macro cards", async ({ page }) => {
    // Should see the Today tab active
    await expect(page.getByRole("tab", { name: /today/i })).toHaveAttribute("aria-selected", "true");
    // Should see calorie-related content
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
  });

  test("can navigate between tabs", async ({ page }) => {
    // Click Discover
    await page.getByRole("tab", { name: /discover/i }).click();
    await page.waitForTimeout(500);
    // Click Plan
    await page.getByRole("tab", { name: /plan/i }).click();
    await page.waitForTimeout(500);
    // Click Progress
    await page.getByRole("tab", { name: /progress/i }).click();
    await page.waitForTimeout(500);
    // Click Profile
    await page.getByRole("tab", { name: /profile/i }).click();
    await page.waitForTimeout(500);
    // Back to Today
    await page.getByRole("tab", { name: /today/i }).click();
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
  });

  test("Settings page shows notification labels correctly", async ({ page }) => {
    await page.getByRole("tab", { name: /profile/i }).click();
    await page.waitForTimeout(500);
    // Navigate to settings
    await page.getByText(/settings/i).first().click();
    await page.waitForTimeout(1000);
    // Check notification labels are human-readable (not camelCase)
    const pageText = await page.textContent("body");
    expect(pageText).not.toContain("newRecipes"); // should be "New recipes from people you follow"
    expect(pageText).not.toContain("mealReminders"); // should be "Meal plan ready"
  });

  test("recipe import page accepts a URL", async ({ page }) => {
    // Navigate to import
    const params = new URLSearchParams({ view: "import" });
    await page.goto(`/?${params.toString()}`);
    await page.waitForTimeout(2000);
    // Should see a URL input
    const urlInput = page.getByPlaceholder(/paste a recipe url/i).or(page.getByPlaceholder(/url/i));
    await expect(urlInput.first()).toBeVisible();
  });
});
