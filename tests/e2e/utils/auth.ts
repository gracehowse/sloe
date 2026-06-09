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

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });

      const acceptCookies = page.getByRole("button", { name: /accept all/i });
      if (await acceptCookies.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acceptCookies.click();
      }

      // Chooser-first /login (2026-06-08 redesign): the email/password form is
      // revealed behind a "Continue with email" button. Click it (if present)
      // before querying the email field.
      const continueWithEmail = page.getByRole("button", { name: /continue with email/i });
      if (await continueWithEmail.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continueWithEmail.click();
      }

      const emailInput = page.getByPlaceholder("you@domain.com");
      const passwordInput = page.getByPlaceholder(/your password/i);
      await expect(emailInput).toBeVisible({ timeout: 15_000 });
      await emailInput.fill(email);
      await passwordInput.fill(password);

      const signIn = page.getByRole("button", { name: "Sign in", exact: true }).last();
      await Promise.all([
        page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 60_000 }),
        signIn.click(),
      ]);
      lastError = undefined;
      break;
    } catch (e) {
      lastError = e;
      if (attempt === 1) break;
      await page.waitForTimeout(1500);
    }
  }
  if (lastError) {
    const authError = await page
      .getByText(/invalid|incorrect|confirm your email|could not sign in/i)
      .first()
      .isVisible()
      .catch(() => false);
    throw new Error(
      authError
        ? "E2E sign-in failed — check credentials or email confirmation in Supabase."
        : `E2E sign-in did not leave /login after 2 attempts: ${String(lastError)}`,
    );
  }

  if (page.url().includes("/onboarding")) {
    throw new Error(
      "E2E user was sent to /onboarding — complete profile fields in Supabase for this account (targets, age, height, weight, sex, activity, goal).",
    );
  }

  const keepGoing = page.getByRole("button", { name: /keep going|continue|got it|close/i }).first();
  if (await keepGoing.isVisible({ timeout: 2000 }).catch(() => false)) {
    await keepGoing.click().catch(() => undefined);
  }

  await page.goto("/today", { waitUntil: "domcontentloaded" });
  const todayNav = page
    .getByRole("tab", { name: /^Today$/i })
    .or(page.getByRole("button", { name: /^Today$/i }));
  try {
    await expect(todayNav.first()).toBeVisible({ timeout: 30_000 });
  } catch {
    const onLanding = await page.getByRole("link", { name: /^sign in$/i }).first().isVisible().catch(() => false);
    throw new Error(
      onLanding
        ? "E2E sign-in did not establish a session — verify E2E_EMAIL/E2E_PASSWORD against NEXT_PUBLIC_SUPABASE_URL and email confirmation."
        : "E2E sign-in succeeded but the app shell did not load — expected Today navigation on /today.",
    );
  }
}
