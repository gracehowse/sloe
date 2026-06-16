/**
 * ENG-970 / ENG-966 — Gate 1.5 paywall honesty wiring (mobile).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");

describe("mobile paywall — Gate 1.5 honesty (ENG-970 / ENG-966)", () => {
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("imports and renders the no-payment-due chip above the sticky CTA", () => {
    expect(src).toContain('from "@/components/paywall/PaywallNoPaymentChip"');
    expect(src).toContain("<PaywallNoPaymentChip />");
    expect(src).toMatch(/trialApplies[\s\S]*PaywallNoPaymentChip/);
    expect(src).toContain('testID="paywall-sticky-primary-cta"');
  });

  it("loads onboarding targets and renders the personalised plan card", () => {
    expect(src).toContain('from "@/components/paywall/PaywallPersonalisedPlanCard"');
    expect(src).toContain("shouldLeadPaywallWithPersonalisedPlan");
    expect(src).toContain("buildPersonalisedPlanPaywallSummary");
    expect(src).toContain("<PaywallPersonalisedPlanCard");
    expect(src).toContain("target_calories_source");
  });
});
