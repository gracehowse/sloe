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

  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const acceptCookies = page.getByRole("button", { name: /accept all/i });
  if (await acceptCookies.isVisible({ timeout: 3000 }).catch(() => false)) {
    await acceptCookies.click();
  }

  const emailInput = page.getByPlaceholder("you@domain.com");
  const passwordInput = page.getByPlaceholder(/your password/i);
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);

  // `/login` and `/signin` use hideTabs — one submit button (see loginPermissive).
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 45_000 });

  if (page.url().includes("/onboarding")) {
    throw new Error(
      "E2E user was sent to /onboarding — complete profile fields in Supabase for this account (targets, age, height, weight, sex, activity, goal).",
    );
  }

  const keepGoing = page.getByRole("button", { name: /keep going|continue|got it|close/i }).first();
  if (await keepGoing.isVisible({ timeout: 2000 }).catch(() => false)) {
    await keepGoing.click().catch(() => undefined);
  }
}
