import { expect, type Page } from "@playwright/test";

export function hasE2ECredentials(): boolean {
  return Boolean(process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD?.trim());
}

/**
 * Dismiss the CookieConsent bottom strip if it's visible. Mounted in
 * `app/providers.tsx` for every route, the strip is `fixed bottom-0 z-50`
 * and can intercept submit-button clicks on short viewports (mobile,
 * narrow desktop). Setting localStorage before navigate is the cleanest
 * dismissal — the banner reads `getConsentChoice()` on mount and stays
 * hidden when it sees `accepted`.
 */
export async function dismissCookieConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("suppr_cookie_consent", "accepted");
    } catch {
      /* localStorage unavailable */
    }
  });
}

/**
 * Shared sign-in core. Handles: cookie consent suppression, navigation,
 * form fill, submit, and URL departure from /login. Does NOT assert on
 * the post-login surface — callers add their own strict / permissive
 * check.
 *
 * Selector strategy: anchor on the email input (unique placeholder
 * `you@domain.com`). The submit button is uniquely identifiable in
 * signin mode by its enabled state and `not(:disabled)` + text "Sign in"
 * scoped to the form card. Avoids the brittle `.first()` / `.nth(1)`
 * dance against the tab-strip "Sign in" button that the old spec used.
 */
export async function signInFlow(page: Page): Promise<void> {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set");
  }

  await dismissCookieConsent(page);
  // domcontentloaded — `networkidle` is unreliable with PostHog / Sentry /
  // RUM beacons that never go quiet.
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });

  const emailInput = page.getByPlaceholder("you@domain.com");
  const passwordInput = page.getByPlaceholder(/your password/i);
  await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 5_000 });

  // Fill both, then ASSERT the values stuck — React controlled inputs
  // can re-render during fill and silently drop the value (caught in
  // the wild on cold dev-server boot when the auth provider hydrates
  // mid-fill). The expect-toHaveValue retries until the value lands.
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await expect(emailInput).toHaveValue(email, { timeout: 5_000 });
  await expect(passwordInput).toHaveValue(password, { timeout: 5_000 });

  // Submit button — in signin mode the form's main CTA reads "Sign in"
  // (line 406 of app/login/ui.tsx). The /login page renders BOTH a
  // tab-strip "Sign in" toggle AND a submit "Sign in" inside the same
  // rounded-2xl card, in that DOM order. The submit is always the
  // LAST matching button; clicking the tab is a no-op when the form
  // is already in signin mode (default for /login).
  const signInButtons = page.getByRole("button", { name: /^Sign in$/i });
  await signInButtons.last().click();

  // Race: either we leave /login (success), or any error / validation
  // message appears on the form. Fail fast on the error path so the
  // test doesn't burn 45s waiting for a navigation that will never
  // happen. Pattern covers Supabase errors ("Invalid login
  // credentials", "Email not confirmed") AND local validation ("Enter
  // an email address.", "Enter a password.").
  await Promise.race([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 }),
    page
      .locator("p", { hasText: /invalid|incorrect|wrong|error|enter (a|an) (email|password)|email not confirmed|too many requests/i })
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(async () => {
        const msg = await page.locator("p").filter({ hasText: /./ }).last().innerText().catch(() => "");
        throw new Error(`Sign-in failed: ${msg || "form returned an error state"}`);
      }),
  ]);
}

/**
 * Sign in via /login UI. Requires E2E_EMAIL and E2E_PASSWORD.
 * The account must have a **complete** Supabase `profiles` row (targets, age, height, etc.)
 * or the app redirects to /onboarding.
 */
export async function loginWithTestUser(page: Page): Promise<void> {
  await signInFlow(page);

  if (page.url().includes("/onboarding")) {
    throw new Error(
      "E2E user was sent to /onboarding — complete profile fields in Supabase for this account (targets, age, height, weight, sex, activity, goal).",
    );
  }

  await expect(page.getByRole("heading", { name: /^Suppr$/i }).first()).toBeVisible({ timeout: 25_000 });
}
