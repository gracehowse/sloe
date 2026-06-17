/**
 * `barcodeConfidenceTier` — shared cross-platform classifier (ENG-737,
 * 2026-06-17). The rule now lives in `src/lib/nutrition/barcodeConfidence.ts`
 * and is consumed by BOTH the web barcode result card
 * (`today-barcode-dialog.tsx`) and the mobile barcode result sheet
 * (via `@suppr/shared/nutrition/barcodeConfidence` → `lib/verifyRecipe.ts`).
 *
 * This mirrors the mobile `apps/mobile/tests/unit/barcodeConfidenceTier.test.ts`
 * against the SAME implementation, so the two surfaces can never drift. It also
 * guards the CLAUDE.md trust posture: "Verified" must be backed by a real
 * signal, never assumed.
 */
import { describe, expect, it } from "vitest";

import {
  barcodeConfidenceTier,
  type BarcodeConfidenceTier,
} from "../../src/lib/nutrition/barcodeConfidence";

describe("barcodeConfidenceTier (shared)", () => {
  it("verified source row → verified", () => {
    expect(barcodeConfidenceTier({ verified: true })).toBe("verified");
  });

  it("unverified row → estimated", () => {
    expect(barcodeConfidenceTier({ verified: false })).toBe("estimated");
  });

  it("missing verified flag → estimated (never assume Verified)", () => {
    // A raw Open Food Facts lookup carries no `verified` field — this is the
    // exact case the web barcode card hits, and it must read "Estimated".
    expect(barcodeConfidenceTier({})).toBe("estimated");
  });

  it("basis-corrected row → estimated even if it was flagged verified", () => {
    expect(barcodeConfidenceTier({ verified: true, basisCorrected: true })).toBe(
      "estimated",
    );
  });

  it("basis-corrected unverified row → estimated", () => {
    expect(
      barcodeConfidenceTier({ verified: false, basisCorrected: true }),
    ).toBe("estimated");
  });

  it("only ever returns the two honest tiers", () => {
    const tiers: BarcodeConfidenceTier[] = [
      barcodeConfidenceTier({ verified: true }),
      barcodeConfidenceTier({}),
    ];
    for (const t of tiers) expect(["verified", "estimated"]).toContain(t);
  });
});
