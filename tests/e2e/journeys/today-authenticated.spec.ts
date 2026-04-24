import { expect, test } from "@playwright/test";
import { hasE2ECredentials, loginWithTestUser } from "../utils/auth";

/**
 * Minimal authenticated **Today / tracker** smoke — complements the wider
 * view matrix in `authenticated-views.spec.ts`. Skips when
 * `E2E_EMAIL` / `E2E_PASSWORD` are unset (fork PRs, local quick runs).
 */
test.describe("Today critical path (authenticated)", () => {
  test.beforeEach(() => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL and E2E_PASSWORD to run this journey.");
  });

  test("after login, Today tracker shows Meals and calorie guidance", async ({ page }) => {
    await loginWithTestUser(page);

    const acceptBtn = page.getByRole("button", { name: /accept all/i });
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
    }

    await page.goto("/?view=tracker");
    await expect(page.getByRole("tab", { name: /^Today$/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: /^Meals$/i })).toBeVisible();
    await expect(
      page.getByText(/Click (the )?ring to (show|hide) macros|Tap for macro breakdown|Showing macro breakdown/i),
    ).toBeVisible();
  });
});
