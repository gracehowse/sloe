/**
 * Paywall trial-end disclosure — wave-2 (2026-04-30 audit-vs-competitors)
 * FIX 4 — trust-grade guard against stale calendar dates.
 *
 * The pre-2026-04-30 disclosure rendered `today + 7` as a
 * concrete calendar date inline ("Your 7-day free trial ends on
 * Apr 30, 2026; first charge on Apr 30, 2026."). Apple anchors the
 * actual trial-end + first-charge dates from the receipt's purchase
 * moment — if the user delayed purchase by 2 days, the printed date
 * was wrong by 2 days. That is a trust-grade fault.
 *
 * Wave-2 swaps the disclosure to a length-and-cadence form:
 * "Starts your 7-day free trial — first charge after 7 days." The
 * concrete dates are now owned by Apple's own subscription manager
 * (post-purchase). Every other CMA element is preserved: price,
 * renewal frequency, auto-renew until cancelled, cancel path, VAT
 * inclusion, refund policy.
 *
 * This test guards against re-introducing the date pattern.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");
const SRC = readFileSync(PAYWALL_PATH, "utf8");

describe("Paywall trial disclosure (wave-2 FIX 4)", () => {
  it("does NOT render a baked calendar date for trial-end / first-charge", () => {
    // The previous template literal was:
    //   `Your 7-day free trial ends on ${trialEndDateLabel}; first charge on ${firstChargeDateLabel}.`
    // Both variables are gone in the new disclosure.
    expect(SRC).not.toContain("trialEndDateLabel");
    expect(SRC).not.toContain("firstChargeDateLabel");
    expect(SRC).not.toContain("free trial ends on");
    expect(SRC).not.toContain("first charge on ");
  });

  it("uses length-and-cadence copy instead of a baked date", () => {
    // The new pre-purchase disclosure states the trial length + when
    // the first charge falls without a calendar date.
    expect(SRC).toContain("Starts your 7-day free trial");
    expect(SRC).toContain("first charge after 7 days");
  });

  it("preserves the CMA-required elements (renewal cadence + cancel path + VAT + refund)", () => {
    expect(SRC).toContain("renews automatically");
    // Cancel path is platform-branched ("Apple ID > Subscriptions" /
    // "Google Play > Payments & subscriptions"). Either string in the
    // file is fine.
    expect(SRC).toMatch(/Cancel anytime/);
    expect(SRC).toContain("Prices include any applicable VAT");
    expect(SRC).toContain("7-day refund policy");
  });

  // ENG-1381 (legal review 2026-07-09) — the degraded / subscriptionsUnavailable
  // fallback disclosure must NOT print an indicative FALLBACK_PRICES amount
  // (a misleading-price risk on non-GBP storefronts). It states the cadence and
  // defers the exact amount to the App Store instead.
  it("degraded fallback disclosure defers the price to the App Store (no indicative amount)", () => {
    // The old indicative-price caveat is gone.
    expect(SRC).not.toContain("amount shown is indicative");
    expect(SRC).not.toContain("exact price is confirmed at checkout");
    // The price-less cadence form + App Store deferral are present.
    expect(SRC).toContain("renews automatically each");
    expect(SRC).toContain("confirmed on the App Store before you subscribe");
  });
});
