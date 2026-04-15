import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "../utils/a11y";

/**
 * Human-style journeys: each step reads like "when I do X, I expect Y".
 * Prefer getByRole / getByLabel so behavior tracks what users see, not implementation details.
 */
test.describe("Public auth journey", () => {
  test("when I open /login I see sign-up and can switch to sign-in", async ({ page }) => {
    await test.step("I open the login page", async () => {
      await page.goto("/login");
    });

    await test.step("I expect the default mode to be create account", async () => {
      await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
      await expect(page.getByText(/free to start/i)).toBeVisible();
    });

    await test.step("I tap Sign in and expect the sign-in heading", async () => {
      await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
      await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
      await expect(page.getByText(/sign in to continue/i)).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });

    await test.step("I expect email and password fields I can type into", async () => {
      await page.getByPlaceholder("you@domain.com").fill("e2e-check@example.com");
      await page.getByPlaceholder(/your password/i).fill("not-a-real-password");
      await expect(page.getByPlaceholder("you@domain.com")).toHaveValue("e2e-check@example.com");
    });

    await test.step("I expect forgot password affordance on sign-in", async () => {
      await expect(page.getByRole("button", { name: /forgot password/i })).toBeVisible();
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

  test("when I visit home without a session I see the marketing landing", async ({ page }) => {
    await test.step("I open the app root", async () => {
      await page.goto("/");
    });
    await test.step("I expect the public marketing hero and primary CTA", async () => {
      await expect(page.getByRole("heading", { name: /Cook what you discover/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Get started/i }).first()).toBeVisible();
      await expectNoSeriousA11yViolations(page);
    });
  });
});
