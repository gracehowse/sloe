/**
 * ENG-827 — Gate 1.5 redesign cohesion goldens (public surfaces).
 *
 * Locks the cold-open onboarding funnel (welcome + goal) that the viral
 * push lands on before auth. Complements `visual-audit-authed.spec.ts`
 * (Today tabs) and `visual-regression-deep.spec.ts` (paywall dialog).
 */
import { test, expect } from "@playwright/test";
import {
  dismissVisualOverlays,
  seedConsent,
  stabilizeForScreenshot,
} from "./utils/visual";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/** Onboarding renders marketing-scale serif headlines — same drift tolerance as landing/pricing. */
const screenshotOptions = { maxDiffPixelRatio: 0.1 } as const;

/** Goal step is index 2 in STEP_IDS (after welcome / app-choice). */
const GOAL_STEP_INDEX = 2;
const ONBOARDING_STORAGE_KEY = "suppr.onboarding-v2.state";

async function seedOnboardingGoalStep(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(
    ({ key, step }) => {
      localStorage.setItem(key, JSON.stringify({ step }));
    },
    { key: ONBOARDING_STORAGE_KEY, step: GOAL_STEP_INDEX },
  );
}

test.describe("Visual regression — Gate 1.5 onboarding (ENG-827)", () => {
  test.describe.configure({ mode: "parallel" });

  for (const vp of viewports) {
    test(`onboarding welcome ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedConsent(page);
      await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      // ENG-1247 M1: the welcome is now the deep-plum brand screen — the
      // wordmark is the heading and the tagline is a <p>, so wait on the
      // always-present "Get started" CTA instead of the former tagline heading.
      await expect(page.getByRole("button", { name: /Get started/i })).toBeVisible({
        timeout: 20_000,
      });
      await stabilizeForScreenshot(page, 1500);
      await expect(page).toHaveScreenshot(
        `gate15/onboarding-welcome-${vp.name}.png`,
        screenshotOptions,
      );
    });

    test(`onboarding goal step ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedConsent(page);
      await seedOnboardingGoalStep(page);
      await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
      await dismissVisualOverlays(page);
      await expect(page.getByText("What brings you to Sloe?")).toBeVisible({
        timeout: 15_000,
      });
      await stabilizeForScreenshot(page, 1500);
      await expect(page).toHaveScreenshot(
        `gate15/onboarding-goal-${vp.name}.png`,
        screenshotOptions,
      );
    });
  }
});
