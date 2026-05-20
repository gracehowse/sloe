import { expect, type Page } from "@playwright/test";

export function hasE2ECredentials(): boolean {
  return Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim());
}

/**
 * Sign in via /login UI. Requires E2E_EMAIL and E2E_PASSWORD.
 * The account must have a **complete** Supabase `profiles` row (targets, age, height, etc.)
 * or the app redirects to /onboarding.
 */
export async function loginWithTestUser(page: Page): Promise<void> {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set");
  }

  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  await page.getByPlaceholder("you@domain.com").fill(email);
  await page.getByPlaceholder(/your password/i).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).nth(1).click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45_000 });

  if (page.url().includes("/onboarding")) {
    throw new Error(
      "E2E user was sent to /onboarding — complete profile fields in Supabase for this account (targets, age, height, weight, sex, activity, goal).",
    );
  }

  await expect(page.getByRole("heading", { name: /^Suppr$/i }).first()).toBeVisible({ timeout: 25_000 });
}
