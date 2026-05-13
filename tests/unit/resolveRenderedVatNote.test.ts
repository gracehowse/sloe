/**
 * resolveRenderedVatNote — pins the ENG-33 gate that suppresses the
 * "Prices include VAT" claim on UK/EU surfaces when Stripe Tax is
 * not actually computing VAT.
 *
 * Authority: ENG-33 +
 * docs/operations/stripe-tax-launch-checklist.md.
 */

import { describe, expect, it } from "vitest";
import { resolveRenderedVatNote } from "../../src/lib/region/detectRegion";

describe("resolveRenderedVatNote", () => {
  it("passes the UK/EU note through when STRIPE_TAX_ENABLED=true", () => {
    expect(resolveRenderedVatNote("Prices include VAT", true)).toBe(
      "Prices include VAT",
    );
  });

  it("suppresses the UK/EU note when STRIPE_TAX_ENABLED=false — the claim is untrue", () => {
    expect(resolveRenderedVatNote("Prices include VAT", false)).toBe("");
  });

  it("is identity when raw note is already empty (default region)", () => {
    expect(resolveRenderedVatNote("", true)).toBe("");
    expect(resolveRenderedVatNote("", false)).toBe("");
  });

  it("respects an alternative non-empty note when flag is on", () => {
    // Future region notes (e.g. "TVA incluse") must pass through too.
    expect(resolveRenderedVatNote("TVA incluse", true)).toBe("TVA incluse");
  });

  it("does not pass any non-empty note through when flag is off", () => {
    expect(resolveRenderedVatNote("TVA incluse", false)).toBe("");
  });
});
