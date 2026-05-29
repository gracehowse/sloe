import type { Page } from "@playwright/test";

/** Dismiss cookie banner and one-shot checklist overlays before screenshots. */
export async function dismissVisualOverlays(page: Page): Promise<void> {
  const acceptBtn = page.getByRole("button", { name: /accept all/i });
  if (await acceptBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await acceptBtn.click();
    await page.waitForTimeout(400);
  }

  const dismissBtn = page.getByRole("button", { name: /dismiss checklist/i });
  if (await dismissBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dismissBtn.click();
    await page.waitForTimeout(400);
  }

  const keepGoing = page.getByRole("button", { name: /keep going|continue|got it|close/i }).first();
  if (await keepGoing.isVisible({ timeout: 1000 }).catch(() => false)) {
    await keepGoing.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

/** Let fonts, charts, and client hydration settle before snapshot assertions. */
export async function stabilizeForScreenshot(page: Page, ms = 2500): Promise<void> {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(ms);
}
