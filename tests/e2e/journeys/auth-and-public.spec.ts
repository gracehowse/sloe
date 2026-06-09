import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../utils/a11y";

/**
 * Human-style journeys: each step reads like "when I do X, I expect Y".
 * Prefer getByRole / getByLabel so behavior tracks what users see, not implementation details.
 */
test.describe("Public auth journey", () => {
  test("when I open /login I see the chooser, reveal sign-in, and can reach sign-up", async ({ page }) => {
    // Chooser-first /login (Figma 296:2, 2026-06-08 Sloe redesign): the route
    // opens on a calm chooser — positioning headline + "Continue with Apple"
    // + "Continue with email" — and the email/password form is progressively
    // disclosed behind "Continue with email". There is NO "Welcome back"
    // heading anymore. Sign-up is reached via the "Create your account" link
    // (→ /signup), which is itself chooser-first. The test tracks the new
    // flow while keeping its intent: the sign-in form is reachable + typeable,
    // and the account-creation surface is reachable.
    await test.step("I open the login page", async () => {
      await page.goto("/login");
    });

    await test.step("I expect the chooser with Apple + email options", async () => {
      await expect(
        page.getByRole("heading", { name: /cook what you love/i }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue with Apple" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();
    });

    await test.step("I reveal the email form and expect fields I can type into", async () => {
      await page.getByRole("button", { name: "Continue with email" }).click();
      await page.getByPlaceholder("you@domain.com").fill("e2e-check@example.com");
      await page.getByPlaceholder(/your password/i).fill("not-a-real-password");
      await expect(page.getByPlaceholder("you@domain.com")).toHaveValue("e2e-check@example.com");
    });

    await test.step("I expect forgot password affordance on sign-in", async () => {
      await expect(page.getByRole("button", { name: /forgot password/i })).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("I follow Create your account and reach the sign-up surface", async () => {
      // `/login` uses hideTabs — sign-up is a link to /signup, which is also
      // chooser-first. Reveal its email form and confirm the create-account
      // action + "Create a password" field render (sign-up copy, not sign-in).
      await page.getByRole("link", { name: /create your account/i }).click();
      await page.waitForURL("**/signup**", { timeout: 15_000 });
      await page.getByRole("button", { name: "Continue with email" }).click();
      await expect(page.getByPlaceholder(/create a password/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
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
    await test.step("Log in CTA navigates to /login and the email form is reachable", async () => {
      await page.getByRole("link", { name: /log in/i }).first().click();
      await page.waitForURL("**/login**");
      // Chooser-first /login: the email field is disclosed behind
      // "Continue with email".
      await page.getByRole("button", { name: "Continue with email" }).click();
      await expect(page.getByPlaceholder("you@domain.com")).toBeVisible();
    });
  });
});
// trigger CI 2026-05-06
