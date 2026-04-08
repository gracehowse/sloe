import { expect, test } from "@playwright/test";

/**
 * Human-style journeys: each step reads like “when I do X, I expect Y”.
 * Prefer getByRole / getByLabel so behavior tracks what users see, not implementation details.
 */
test.describe("Public auth journey", () => {
  test("when I open /login I see sign-up and can switch to sign-in", async ({ page }) => {
    await test.step("I open the login page", async () => {
      await page.goto("/login");
    });

    await test.step("I expect the default mode to be create account", async () => {
      await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
      await expect(page.getByText(/start with email/i)).toBeVisible();
    });

    await test.step("I tap Sign in and expect the sign-in heading", async () => {
      await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
      await expect(page.getByRole("heading", { name: /^sign in$/i })).toBeVisible();
      await expect(page.getByText(/use your email/i)).toBeVisible();
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
    });
  });

  test("when I open /terms I see terms heading", async ({ page }) => {
    await test.step("I open the terms page", async () => {
      await page.goto("/terms");
    });
    await test.step("I expect terms content", async () => {
      await expect(page.getByRole("heading", { name: /terms/i }).first()).toBeVisible();
    });
  });
});

test.describe("Unauthenticated app shell", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("when I visit home without a session I eventually reach login", async ({ page }) => {
    await test.step("I open the app root", async () => {
      await page.goto("/");
    });
    await test.step("I expect to be sent to login (client redirect)", async () => {
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: /create your account|sign in/i })).toBeVisible();
    });
  });
});
