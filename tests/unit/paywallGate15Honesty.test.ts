import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildPersonalisedPlanPaywallSummary,
  formatProfileGoalLabel,
  shouldLeadPaywallWithPersonalisedPlan,
} from "../../src/lib/paywall/personalisedPlanSummary";
import { PAYWALL_NO_PAYMENT_DUE_CHIP } from "../../src/lib/landing/paywallTrust";

describe("ENG-970 — paywall no-payment-due chip SSOT", () => {
  it("surfaces first-charge-on-day-7 copy for trial state", () => {
    expect(PAYWALL_NO_PAYMENT_DUE_CHIP.label).toContain("No payment due now");
    expect(PAYWALL_NO_PAYMENT_DUE_CHIP.label).toContain("Day 7");
    expect(PAYWALL_NO_PAYMENT_DUE_CHIP.testId).toBe("paywall-no-payment-due-chip");
  });
});

describe("ENG-966 — personalised plan paywall summary", () => {
  it("maps profile goals to short labels", () => {
    expect(formatProfileGoalLabel("cut")).toBe("Lose weight");
    expect(formatProfileGoalLabel("maintain")).toBe("Eat healthier");
    expect(formatProfileGoalLabel("bulk")).toBe("Build muscle");
    expect(formatProfileGoalLabel(null)).toBeNull();
  });

  it("leads when onboarding source or from=onboarding", () => {
    expect(
      shouldLeadPaywallWithPersonalisedPlan({
        targetCalories: 2100,
        targetCaloriesSource: "onboarding",
      }),
    ).toBe(true);
    expect(
      shouldLeadPaywallWithPersonalisedPlan({
        targetCalories: 2100,
        targetCaloriesSource: "user",
        paywallFrom: "onboarding",
      }),
    ).toBe(true);
    expect(
      shouldLeadPaywallWithPersonalisedPlan({
        targetCalories: 2100,
        targetCaloriesSource: "user",
        paywallFrom: "settings",
      }),
    ).toBe(false);
    expect(
      shouldLeadPaywallWithPersonalisedPlan({
        targetCalories: null,
        targetCaloriesSource: "onboarding",
      }),
    ).toBe(false);
  });

  it("builds hero + card copy from persisted targets", () => {
    const summary = buildPersonalisedPlanPaywallSummary({
      targetCalories: 2140,
      targetProtein: 128,
      goal: "cut",
    });
    expect(summary.heroTitle).toBe("Your plan is ready");
    expect(summary.calories).toBe(2140);
    expect(summary.goalLabel).toBe("Lose weight");
    expect(summary.proteinG).toBe(128);
    expect(summary.heroSubtitle).toContain("2,140 kcal");
    expect(summary.heroSubtitle).toContain("lose weight");
  });
});

describe("ENG-966/970 — web pricing paywall wiring", () => {
  const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

  it("loads personalised plan lead on /pricing", () => {
    const page = read("app/pricing/page.tsx");
    expect(page).toContain("PricingPaywallHonesty");
  });

  it("renders no-payment chip on Pro annual checkout", () => {
    const grid = read("app/pricing/PricingTiersGrid.tsx");
    expect(grid).toContain("PricingNoPaymentChip");
    expect(grid).toMatch(/checkoutTier === "pro" && billing === "annual"/);
  });
});
