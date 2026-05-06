import { test, expect } from "@playwright/test";
import { join } from "node:path";

const OUT = join(process.cwd(), "apps/mobile/screenshots/latest");

test.describe("verify #10 privacy", () => {
  test("desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/privacy", { waitUntil: "networkidle" });
    const body = await page.textContent("body");
    expect(body).not.toContain("[PLACEHOLDER");
    await page.screenshot({ path: join(OUT, "verify-10-privacy-desktop.png"), fullPage: true });
  });

  test("mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/privacy", { waitUntil: "networkidle" });
    const body = await page.textContent("body");
    expect(body).not.toContain("[PLACEHOLDER");
    await page.screenshot({ path: join(OUT, "verify-10-privacy-mobile.png"), fullPage: true });
  });
});
