import { test, expect } from "@playwright/test";
import { join } from "node:path";

const OUT = join(process.cwd(), "apps/mobile/screenshots/latest");

test.describe("verify #23 + #24 — pricing hierarchy + cookie strip", () => {
  test("desktop pricing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/pricing", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(OUT, "verify-23-pricing-desktop-after.png"), fullPage: false });
    // Pro now anchors first in the grid order (`highlighted: true` first).
    const firstCard = page.locator('div.relative.rounded-2xl.flex.flex-col').first();
    await expect(firstCard).toContainText("Pro");
    // Full-width ribbon present.
    await expect(page.getByText("Most popular")).toBeVisible();
    // Cookie consent visible as a slim bottom strip (not centred card).
    const consent = page.locator('text=/Suppr uses essential cookies/i').first();
    await expect(consent).toBeVisible();
  });

  test("mobile pricing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pricing", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(OUT, "verify-23-pricing-mobile-after.png"), fullPage: false });
  });
});
