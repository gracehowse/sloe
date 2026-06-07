import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../utils/a11y";

/**
 * Human-style journeys: each step reads like "when I do X, I expect Y".
 * Prefer getByRole / getByLabel so behavior tracks what users see, not implementation details.
 */
test.describe("Public auth journey", () => {
  test("when I open /login I see sign-in and can switch to sign-up", async ({ page }) => {
    // Debug audit 2026-05-04 (customer-lens P0 #8): /login defaults
    // to "signin" mode now. Canonical signup lives at /onboarding;
    // this route is the signin destination from the landing's
    // "Sign in" link. Test reflects the new behaviour — was "signup
    // default" before PR #93. The mode-switcher is still rendered so
    // a user who lands here in error can opt into signup.
    await test.step("I open the login page", async () => {
      await page.goto("/login");
    });

    await test.step("I expect the default mode to be sign-in", async () => {
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
      await expect(page.getByText(/sign in to continue/i)).toBeVisible();
    });

    await test.step("I expect email and password fields I can type into", async () => {
      await page.getByPlaceholder("you@domain.com").fill("e2e-check@example.com");
      await page.getByPlaceholder(/your password/i).fill("not-a-real-password");
      await expect(page.getByPlaceholder("you@domain.com")).toHaveValue("e2e-check@example.com");
    });

    await test.step("I expect forgot password affordance on sign-in", async () => {
      await expect(page.getByRole("button", { name: /forgot password/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("I follow Create your account and expect onboarding/sign-up copy", async () => {
      // `/login` uses hideTabs — sign-up is a link to /onboarding, not a tab button.
      await page.getByRole("link", { name: /create your account/i }).click();
      await page.waitForURL(/\/(onboarding|login|signup)/, { timeout: 15_000 });
      await expect(
        page.getByRole("heading", { name: /create your account|let's build your plan/i }).first(),
      ).toBeVisible();
    });
  });

  test("when I open /privacy I see a privacy heading", async ({ page }) => {
    await test.step("I open the privacy page", async () => {
      await page.goto("/privacy");
    });
    await test.step("I expect a clear privacy title", async () => {
      await expect(page.getByRole("heading", { name: /privacy/i }).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });

  test("when I open /reset-password I see the reset form", async ({ page }) => {
    await test.step("I open the reset password page", async () => {
      await page.goto("/reset-password");
    });
    await test.step("I expect password fields and update action", async () => {
      await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
      await expect(page.getByPlaceholder(/at least 8 characters/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /update password/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });

  test("when I open /terms I see terms heading", async ({ page }) => {
    await test.step("I open the terms page", async () => {
      await page.goto("/terms");
    });
    await test.step("I expect terms content", async () => {
      await expect(page.getByRole("heading", { name: /terms/i }).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });
});

test.describe("Unauthenticated app shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("when I visit home without a session I see the landing page with a log-in path", async ({ page }) => {
    await test.step("I open the app root", async () => {
      await page.goto("/");
    });
    await test.step("I expect the landing page with a Log in CTA", async () => {
      // `/` now renders LandingPage for unauthenticated users (server component
      // branch in app/page.tsx). The middleware no longer force-redirects.
      // Sloe LP1 redesign changed the CTA text from "Sign in" to "Log in".
      await expect(page.getByRole("link", { name: /log in/i }).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
    await test.step("Log in CTA navigates to /login", async () => {
      await page.getByRole("link", { name: /log in/i }).first().click();
      await page.waitForURL("**/login**");
      await expect(page.getByPlaceholder("you@domain.com")).toBeVisible();
    });
  });
});
// trigger CI 2026-05-06
