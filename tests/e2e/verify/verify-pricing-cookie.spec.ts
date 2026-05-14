import { test, expect } from "@playwright/test";
import { join } from "node:path";

const OUT = join(process.cwd(), "apps/mobile/screenshots/latest");

test.describe("verify #23 + #24 — pricing hierarchy + cookie strip", () => {
  test("desktop pricing", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/pricing", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(OUT, "verify-23-pricing-desktop-after.png"), fullPage: false });
    // Pro is sorted first when `highlighted: true` (see PricingTiersGrid).
    await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
    // Full-width ribbon present.
    await expect(page.getByText("Most popular")).toBeVisible();
    // Cookie consent: slim bottom strip (copy in CookieConsent.tsx).
    await expect(page.getByText(/Essential cookies on/i)).toBeVisible();
  });

  test("mobile pricing", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pricing", { waitUntil: "networkidle" });
    await page.screenshot({ path: join(OUT, "verify-23-pricing-mobile-after.png"), fullPage: false });
  });
});
