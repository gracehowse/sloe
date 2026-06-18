import { test, expect } from "@playwright/test";
import {
  publicSubpageScreenshotOptions,
  publicVisualSubpages,
  visualSubpageViewports,
} from "./fixtures/visualSubpages";
import { dismissVisualOverlays, stabilizeForScreenshot } from "./utils/visual";

test.describe("Visual regression — public subpages", () => {
  test.describe.configure({ mode: "parallel" });

  for (const screen of publicVisualSubpages) {
    for (const vp of visualSubpageViewports) {
      test(`${screen.name} ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(screen.path, { waitUntil: "domcontentloaded" });
        await dismissVisualOverlays(page);
        await stabilizeForScreenshot(page);
        await expect(page).toHaveScreenshot(
          `subpages/public/${screen.name}-${vp.name}.png`,
          publicSubpageScreenshotOptions,
        );
      });
    }
  }
});
