import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../utils/a11y";

/**
 * Core user journeys — these test real browser interaction.
 * Requires:
 *   - E2E_EMAIL and E2E_PASSWORD env vars for authenticated tests
 *   - Local: Playwright starts `npm run dev` (see playwright.config.ts). CI uses `next start` from ci.yml.
 */

test.describe("Public pages", () => {
  test("help page loads with methodology section", async ({ page }) => {
    await page.goto("/help");
    await expectNoSeriousA11yViolations(page);
    await expect(page.getByRole("heading", { level: 1, name: /^help$/i })).toBeVisible();
    await expect(page.getByText(/mifflin-st jeor/i)).toBeVisible();
    await expect(page.getByText(/usda fooddata central/i).first()).toBeVisible();
    await expect(page.getByText(/not medical advice/i)).toBeVisible();
  });

  test("privacy page loads with retention section", async ({ page }) => {
    await page.goto("/privacy");
    await expectNoSeriousA11yViolations(page);
    await expect(page.getByRole("heading", { name: /privacy policy/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Data retention$/i })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: /delete your account/i })).toBeVisible();
  });

  test("terms page loads with eligibility section", async ({ page }) => {
    await page.goto("/terms");
    await expectNoSeriousA11yViolations(page);
    await expect(page.getByRole("heading", { name: /terms of service/i })).toBeVisible();
    await expect(page.getByText(/13 years old/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Subscriptions$/ })).toBeVisible();
  });

  test("pricing page loads and shows tiers", async ({ page }) => {
    await page.goto("/pricing");
    await expectNoSeriousA11yViolations(page);
    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });

  test("unauthenticated root shows landing page with a sign-in path", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousA11yViolations(page);
    // LandingPage renders server-side for unauthenticated users (see app/page.tsx).
    // Previously `/` middleware-redirected to /login; it now shows the marketing
    // landing page with a Sign in CTA that opens /login?mode=signin.
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await page.getByRole("link", { name: /sign in/i }).first().click();
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
    // Dismiss cookie consent banner if visible
    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }
  });

  test("Today view shows calorie ring and macro cards", async ({ page }) => {
    // Should see the Today tab active
    await expect(page.getByRole("tab", { name: /today/i })).toHaveAttribute("aria-selected", "true");
    // Should see calorie-related content
    await expect(page.getByText(/kcal/i).first()).toBeVisible();
  });

  test("can navigate between tabs", async ({ page }) => {
    // Click Discover (force: true to bypass Next.js dev overlay in dev mode)
    await page.getByRole("tab", { name: /discover/i }).click({ force: true });
    await page.waitForTimeout(500);
    // Click Plan
    await page.getByRole("tab", { name: /plan/i }).click({ force: true });
    await page.waitForTimeout(500);
    // Click Progress
    await page.getByRole("tab", { name: /progress/i }).click({ force: true });
    await page.waitForTimeout(500);
    // Click Profile
    await page.getByRole("tab", { name: /profile/i }).click({ force: true });
    await page.waitForTimeout(500);
    // Back to Today
    await page.getByRole("tab", { name: /today/i }).click({ force: true });
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
    const urlInput = page.getByPlaceholder(/paste a recipe url/i)
      .or(page.getByPlaceholder(/https:\/\/example\.com\/recipe/i))
      .or(page.getByPlaceholder(/paste a (recipe )?link/i));
    await expect(urlInput.first()).toBeVisible();
  });
});
