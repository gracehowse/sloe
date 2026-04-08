import { expect, test } from "@playwright/test";

test("loads login page", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading")).toContainText(/create your account|sign in|login/i);
});

