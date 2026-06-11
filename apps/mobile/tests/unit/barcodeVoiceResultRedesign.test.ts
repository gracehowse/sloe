/**
 * Barcode + voice result sheets — search-results redesign language
 * (ENG-817, 2026-05-31).
 *
 * After the food-search redesign lands, the barcode-scan result
 * (`app/(tabs)/barcode.tsx`) and the voice-log result
 * (`AiLogReviewItem.tsx`, used by `VoiceLogSheet`) must adopt the same
 * design language — a legible Verified/Estimated confidence chip and a blue
 * commit CTA — gated behind `redesign_search_results`, with the old path
 * alive in the else.
 *
 * Why structural pins: the barcode screen and the AI review row are large
 * RN surfaces (camera overlay / Modal-hosted) that vitest/jsdom can't fully
 * render; this is the same approach as `aiLogReviewParity.test.ts` and
 * `barcodeLogToggleAndAutoLog.test.ts`. The chip component itself is render-
 * tested in `searchResultConfidenceChip.test.tsx`, and the barcode tier
 * logic in `barcodeConfidenceTier.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const BARCODE = readFileSync(
  resolve(__dirname, "../../app/(tabs)/barcode.tsx"),
  "utf8",
);
const REVIEW_ITEM = readFileSync(
  resolve(__dirname, "../../components/AiLogReviewItem.tsx"),
  "utf8",
);

describe("barcode result — redesign gate", () => {
  it("reads the redesign_search_results flag", () => {
    expect(BARCODE).toMatch(/isFeatureEnabled\(["']redesign_search_results["']\)/);
  });

  it("renders the shared SearchResultConfidenceChip under the flag", () => {
    expect(BARCODE).toMatch(/import\s+\{\s*SearchResultConfidenceChip\s*\}/);
    expect(BARCODE).toMatch(/<SearchResultConfidenceChip/);
    expect(BARCODE).toMatch(/testID="barcode-confidence-chip"/);
  });

  it("derives the chip tier from the honest barcodeConfidenceTier helper", () => {
    expect(BARCODE).toMatch(/tier=\{barcodeConfidenceTier\(product\)\}/);
  });

  it("keeps the old binary tick path alive behind the else", () => {
    // The pre-redesign tick + source line must survive for the flag-off path.
    expect(BARCODE).toMatch(/product\.verified \?/);
    expect(BARCODE).toMatch(/<Check size=\{11\}/);
  });

  it("paints the commit CTA with the secondary accent under the flag", () => {
    // The default StyleSheet logBtn stays green (flag-off path); the call
    // site overrides to the secondary accent when searchRedesign is on.
    // ENG-997: that read goes through `accent.primary` (from `useAccent()`),
    // which is now the unconditional clay (the Frost secondary-colour
    // exploration was retired 2026-06-08), rather than the static
    // `Accent.primary`. The hook indirection is kept; it just always returns clay.
    expect(BARCODE).toMatch(
      /searchRedesign\s*&&\s*\{\s*backgroundColor:\s*accent\.primary\s*\}/,
    );
  });

  it("does NOT recolour the default logBtn StyleSheet (else path stays green)", () => {
    expect(BARCODE).toMatch(/logBtn:\s*\{[\s\S]*?backgroundColor:\s*Accent\.success/);
  });
});

describe("voice-log result — redesign gate", () => {
  it("reads the redesign_search_results flag in the review row", () => {
    expect(REVIEW_ITEM).toMatch(
      /isFeatureEnabled\(["']redesign_search_results["']\)/,
    );
  });

  it("renders the shared confidence chip, always as 'estimated' (AI is never Verified)", () => {
    expect(REVIEW_ITEM).toMatch(/import\s+\{\s*SearchResultConfidenceChip\s*\}/);
    expect(REVIEW_ITEM).toMatch(/<SearchResultConfidenceChip\s+tier="estimated"/);
    // No "verified" tier may be passed from the AI review surface.
    expect(REVIEW_ITEM).not.toMatch(/<SearchResultConfidenceChip\s+tier="verified"/);
    expect(REVIEW_ITEM).toMatch(/testID="voice-confidence-chip"/);
  });

  it("only renders the redesign chip when the flag is on", () => {
    expect(REVIEW_ITEM).toMatch(
      /searchRedesign\s*&&\s*\(\s*\n?\s*<SearchResultConfidenceChip/,
    );
  });

  it("keeps the low-confidence amber border as a load-bearing trust signal", () => {
    // Elevation is only applied to non-low rows; low rows always keep the
    // amber border even under the redesign flag.
    expect(REVIEW_ITEM).toMatch(/searchRedesign\s*&&\s*!low/);
    expect(REVIEW_ITEM).toMatch(/Accent\.warning \+ "55"/);
  });
});
