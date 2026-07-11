/**
 * Onboarding upgrade step — claims honesty (ENG-1510).
 *
 * The trial step is the terminal onboarding conversion moment. Two claim
 * classes are pinned:
 *   1. It must NOT sell free-forever features (barcode scanning, custom
 *      macros — Free tier per src/lib/landing/pricingTiers.ts, merchandised
 *      as the free MFP-switch wins on the landing, ENG-1203) as Pro-trial
 *      benefits.
 *   2. Mobile must NOT print a fixed-GBP figure to every storefront — App
 *      Store prices are localised and VAT-inclusive (2026-07-09
 *      degraded-paywall decision), so the amount defers to the paywall /
 *      App Store confirmation sheet.
 * Web + mobile twins pinned together (parity non-negotiable).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const MOBILE = fs.readFileSync(
  path.join(ROOT, "apps/mobile/components/onboarding/steps/upgrade.tsx"),
  "utf-8",
);
const WEB = fs.readFileSync(
  path.join(ROOT, "src/app/components/onboarding/steps/upgrade.tsx"),
  "utf-8",
);

describe("onboarding upgrade step — claims honesty (ENG-1510)", () => {
  it.each([
    ["mobile", MOBILE],
    ["web", WEB],
  ])("%s: does not sell free-forever features as Pro-trial benefits", (_platform, src) => {
    expect(src).not.toMatch(/barcode scanning/i);
    expect(src).not.toMatch(/custom macros/i);
  });

  it.each([
    ["mobile", MOBILE],
    ["web", WEB],
  ])("%s: pitches genuinely-Pro props in the trial subtitle", (_platform, src) => {
    // SSOT-exact phrasing (src/lib/landing/pricingTiers.ts Pro tier):
    // "Unlimited saved recipes" + "Multi-day meal plans matched to your
    // macro targets". Free ships recipe *import* and a 1-day plan, so the
    // pitch must say saved recipes + multi-day, not the free-held forms.
    expect(src).toMatch(/unlimited saved recipes/i);
    expect(src).toMatch(/multi-day macro-matched meal plans/i);
    expect(src).not.toMatch(/unlimited recipe imports/i);
  });

  it("mobile: defers the exact price to the App Store — no fixed-GBP SSOT figure", () => {
    expect(MOBILE).not.toMatch(/annualPrice/);
    expect(MOBILE).not.toMatch(/£\d/);
    expect(MOBILE).toMatch(/exact price confirms in the App Store/);
  });
});
