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

  test("unauthenticated root shows landing page with a log-in path", async ({ page }) => {
    await page.goto("/");
    await expectNoSeriousA11yViolations(page);
    // LandingPage renders server-side for unauthenticated users (see app/page.tsx).
    // Previously `/` middleware-redirected to /login; it now shows the marketing
    // landing page with a Log in CTA that opens /login.
    // Sloe LP1 redesign changed CTA from "Sign in" to "Log in".
    await expect(page.getByRole("link", { name: /log in/i }).first()).toBeVisible();
    await page.getByRole("link", { name: /log in/i }).first().click();
    await page.waitForURL("**/login**");
    await expect(page.getByPlaceholder("you@domain.com")).toBeVisible();
  });
});
