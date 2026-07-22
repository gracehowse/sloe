/**
 * Barcode + voice result sheets — search-results redesign language
 * (ENG-817, 2026-05-31).
 *
 * The barcode-scan result (`app/(tabs)/barcode.tsx`) and the voice-log
 * result (`AiLogReviewItem.tsx`, used by `VoiceLogSheet`) share the same
 * design language — a legible Verified/Estimated confidence chip and a blue
 * commit CTA. This shipped behind `redesign_search_results`, which
 * collapsed permanently-on (ENG-1651, 2026-07-22): the flag was ON via
 * REDESIGN_DEFAULT_ON in every build since ENG-814/815 (2026-05-31/06-01),
 * so the gate was removed from source and the ON-path styling now applies
 * unconditionally. There is no old path left to pin.
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
  it("no longer reads the redesign_search_results flag (collapsed permanently-on, ENG-1651)", () => {
    expect(BARCODE).not.toMatch(/isFeatureEnabled\(["']redesign_search_results["']\)/);
  });

  it("renders the shared SearchResultConfidenceChip unconditionally", () => {
    expect(BARCODE).toMatch(/import\s+\{\s*SearchResultConfidenceChip\s*\}/);
    expect(BARCODE).toMatch(/<SearchResultConfidenceChip/);
    expect(BARCODE).toMatch(/testID="barcode-confidence-chip"/);
  });

  it("derives the chip tier from the honest barcodeConfidenceTier helper", () => {
    expect(BARCODE).toMatch(/tier=\{barcodeConfidenceTier\(product\)\}/);
  });

  it("paints the commit CTA with the secondary accent unconditionally", () => {
    // ENG-997: that read goes through `accent.primary` (from `useAccent()`),
    // which is now the unconditional clay (the Frost secondary-colour
    // exploration was retired 2026-06-08), rather than the static
    // `Accent.primary`. The hook indirection is kept; it just always returns clay.
    // ENG-1651: the old `searchRedesign &&` gate on this override is gone —
    // the accent applies unconditionally now.
    expect(BARCODE).toMatch(
      /\{\s*backgroundColor:\s*accent\.primary\s*\}/,
    );
  });
});

describe("voice-log result — redesign gate", () => {
  it("no longer reads the redesign_search_results flag in the review row (collapsed permanently-on, ENG-1651)", () => {
    expect(REVIEW_ITEM).not.toMatch(
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

  it("renders the redesign chip unconditionally", () => {
    // ENG-1651: the old `searchRedesign && (...)` gate around the chip is
    // gone — it renders unconditionally now.
    expect(REVIEW_ITEM).not.toMatch(/searchRedesign/);
    expect(REVIEW_ITEM).toMatch(
      /<SearchResultConfidenceChip\s+tier="estimated"\s+testID="voice-confidence-chip"\s*\/>/,
    );
  });

  it("keeps the low-confidence amber border as a load-bearing trust signal", () => {
    // Elevation is only applied to non-low rows; low rows always keep the
    // amber border. ENG-1651: this is no longer paired with a redesign flag
    // check — the `!low` branch is unconditional now.
    expect(REVIEW_ITEM).toMatch(/!low\s*\n?\s*\?\s*\{/);
    // ENG-1521 — the amber border reads the named SoftStrong token.
    expect(REVIEW_ITEM).toMatch(/Accent\.warningSoftStrong/);
  });
});
