/**
 * `barcodeConfidenceTier` — the honest Verified / Estimated classifier for a
 * scanned barcode product, feeding the barcode result sheet's confidence chip
 * (search-results redesign, 2026-05-31).
 *
 * CLAUDE.md trust posture: "Verified" must be backed by a real signal. These
 * tests pin that a chip can never claim Verified unless the source row is
 * genuinely flagged verified, and that a reconstructed per-100g basis
 * (basisCorrected) always drops to Estimated even when the row was verified —
 * because we no longer trust the published panel.
 */
import { describe, expect, it } from "vitest";

import { barcodeConfidenceTier } from "../../lib/barcodeConfidence";

describe("barcodeConfidenceTier", () => {
  it("verified source row → verified", () => {
    expect(barcodeConfidenceTier({ verified: true })).toBe("verified");
  });

  it("unverified row → estimated", () => {
    expect(barcodeConfidenceTier({ verified: false })).toBe("estimated");
  });

  it("missing verified flag → estimated (never assume Verified)", () => {
    expect(barcodeConfidenceTier({})).toBe("estimated");
  });

  it("basis-corrected row → estimated even if it was flagged verified", () => {
    expect(
      barcodeConfidenceTier({ verified: true, basisCorrected: true }),
    ).toBe("estimated");
  });

  it("basis-corrected unverified row → estimated", () => {
    expect(
      barcodeConfidenceTier({ verified: false, basisCorrected: true }),
    ).toBe("estimated");
  });
});
