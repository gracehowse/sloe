/**
 * AI log review parity (audit B5, 2026-04-30).
 *
 * The voice and photo AI logging sheets share the review UX surface —
 * confidence chips, "Log anyway" gate, low-confidence amber border,
 * AI-estimate badge. Before the 2026-04-30 lift, both sheets carried
 * near-identical 100-line copies of the review-row + summary blocks,
 * which let the two surfaces drift between releases (audit finding:
 * photo path was thinner than voice on competitive parity vs Cal AI).
 *
 * Both sheets now compose from `<AiLogReviewItem>` and
 * `<AiLogReviewSummary>`. This test pins that invariant — any new
 * AI-logging surface added in the future must reuse the same shared
 * components so parity is enforced by construction, not by review.
 *
 * Why a structural test: vitest/jsdom cannot render the React Native
 * sheets (Modal + KeyboardAvoidingView + TextInput driver constraints).
 * RNTL is on the R7 backlog; until then we grep the source files for
 * the load-bearing imports and assert both sheets reach for the same
 * primitives. Same approach as `cookAnalyticsParity.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PHOTO_PATH = resolve(__dirname, "../../components/PhotoLogSheet.tsx");
const VOICE_PATH = resolve(__dirname, "../../components/VoiceLogSheet.tsx");
const VOICE_ACTIONS_PATH = resolve(__dirname, "../../components/voice/VoiceLogSheetActions.tsx");
const ITEM_PATH = resolve(__dirname, "../../components/AiLogReviewItem.tsx");
const SUMMARY_PATH = resolve(__dirname, "../../components/AiLogReviewSummary.tsx");

const PHOTO_SRC = readFileSync(PHOTO_PATH, "utf8");
const VOICE_SRC = readFileSync(VOICE_PATH, "utf8");
const VOICE_ACTIONS_SRC = readFileSync(VOICE_ACTIONS_PATH, "utf8");
const ITEM_SRC = readFileSync(ITEM_PATH, "utf8");
const SUMMARY_SRC = readFileSync(SUMMARY_PATH, "utf8");

describe("AI log review parity (audit B5)", () => {
  describe("PhotoLogSheet (range-first re-architecture, 2026-05-01)", () => {
    // The photo-log sheet was rebuilt 2026-05-01 around the new
    // range-first ChatGPT-grade itemized breakdown shape (per
    // Grace's screenshot bar in
    // `docs/decisions/2026-05-01-photo-log-rangefirst.md`):
    // grouped by macro role, kcal RANGES per item, opt-in addon
    // chips, plate total banner. The voice-log sheet keeps the
    // single-row-per-item shape because voice transcription gives
    // structured output (not a photo + uncertainty), so the
    // shared `AiLogReviewItem` / `AiLogReviewSummary` row pattern
    // still fits voice but no longer fits photo.
    //
    // Photo-log parity now lives in
    // `tests/unit/photoLogSheetGrouping.test.ts` (mobile structural)
    // and `tests/unit/photoLogDialogGrouping.test.tsx` (web render),
    // which pin the new shared range-aware helpers
    // (`groupItemsByCategory`, `formatRangeKcal`, `sumRanges`,
    // `rangedItemToLogged`).
    it("imports the range-aware helpers from the shared lib", () => {
      expect(PHOTO_SRC).toMatch(/groupItemsByCategory/);
      expect(PHOTO_SRC).toMatch(/formatRangeKcal/);
      expect(PHOTO_SRC).toMatch(/rangedItemToLogged/);
    });

    it("renders the grouped breakdown (groups.map -> group.items.map)", () => {
      expect(PHOTO_SRC).toMatch(/groups\.map\(\(group\)/);
      expect(PHOTO_SRC).toMatch(/group\.items\.map\(\(item\)/);
    });

    it("flags low-confidence items with the amber 'verify before logging' note", () => {
      expect(PHOTO_SRC).toMatch(/Low confidence — verify before logging/);
    });

    it("'Save to today' projects items via rangedItemToLogged before onCommit", () => {
      expect(PHOTO_SRC).toMatch(
        /projected\s*=\s*items\.map\(\(it\)\s*=>\s*rangedItemToLogged\(it\)\)/,
      );
      expect(PHOTO_SRC).toMatch(/onCommit\(projected/);
    });

    it("uses 'Save to today' as the primary CTA copy (matches Grace's screenshot brief)", () => {
      expect(PHOTO_SRC).toMatch(/Save to today/);
    });

    it("renders add-on chips that promote into items[] on tap", () => {
      expect(PHOTO_SRC).toMatch(/addons\.map\(\(addon\)/);
      expect(PHOTO_SRC).toMatch(/setItems\(\(prev\)\s*=>\s*\[/);
    });
  });

  describe("VoiceLogSheet", () => {
    it("imports the shared AiLogReviewItem component", () => {
      expect(VOICE_SRC).toMatch(
        /import\s+AiLogReviewItem\s+from\s+["']\.\/AiLogReviewItem["']/,
      );
    });

    it("imports the shared AiLogReviewSummary component", () => {
      expect(VOICE_SRC).toMatch(
        /import\s+AiLogReviewSummary\s+from\s+["']\.\/AiLogReviewSummary["']/,
      );
    });

    it("renders review rows via the shared component", () => {
      expect(VOICE_SRC).toMatch(/<AiLogReviewItem\b/);
    });

    it("renders the totals summary via the shared component", () => {
      expect(VOICE_SRC).toMatch(/<AiLogReviewSummary\b/);
    });

    it("uses the 'Log anyway' label when any item is low confidence", () => {
      expect(VOICE_ACTIONS_SRC).toMatch(/hasLowConfidence\s*\?\s*"Log anyway"/);
    });
  });

  describe("AiLogReviewItem (shared row)", () => {
    it("uses the shared aiLogging confidence helpers", () => {
      // Pulls from `src/lib/nutrition/aiLogging.ts` so item-row and
      // header summaries can never disagree on what counts as "low".
      expect(ITEM_SRC).toMatch(/from\s+["']@suppr\/(?:shared\/nutrition|nutrition-core)\/aiLogging["']/);
      expect(ITEM_SRC).toMatch(/\bisLowConfidence\b/);
      expect(ITEM_SRC).toMatch(/\bclassifyConfidence\b/);
    });

    it("renders the percentage form of the confidence value", () => {
      // Audit ask: chips read "92%" not just "High" so the user
      // gets the actual number Cal AI surfaces.
      expect(ITEM_SRC).toMatch(/confidencePercentLabel/);
    });

    it("flags the row with the low-confidence amber border", () => {
      // The amber border is the visual gate — without it the user
      // can scroll past a 0.4 confidence row without noticing.
      // ENG-1521 — the border reads the named SoftStrong token (the old
      // `Accent.warning + "55"` alpha-concat is banned by check:token-scale).
      expect(ITEM_SRC).toMatch(/Accent\.warningSoftStrong/);
    });

    it("emits the 'Low confidence — please verify' alert when low", () => {
      expect(ITEM_SRC).toMatch(
        /Low confidence — please verify portion and macros before logging/,
      );
    });

    it("exposes confidenceColor / confidenceLabel / confidencePercentLabel as named exports for the summary to reuse", () => {
      // The summary surface should not roll its own copy.
      expect(ITEM_SRC).toMatch(/export\s+function\s+confidenceColor\b/);
      expect(ITEM_SRC).toMatch(/export\s+function\s+confidenceLabel\b/);
      expect(ITEM_SRC).toMatch(/export\s+function\s+confidencePercentLabel\b/);
    });
  });

  describe("AiLogReviewSummary (shared header)", () => {
    it("imports confidenceColor / confidenceLabel / confidencePercentLabel from the shared item", () => {
      expect(SUMMARY_SRC).toMatch(/from\s+["']\.\/AiLogReviewItem["']/);
      expect(SUMMARY_SRC).toMatch(/confidenceColor/);
      expect(SUMMARY_SRC).toMatch(/confidenceLabel/);
      expect(SUMMARY_SRC).toMatch(/confidencePercentLabel/);
    });

    it("renders an 'Overall AI confidence' chip computed from averageConfidence", () => {
      expect(SUMMARY_SRC).toMatch(/Overall AI confidence/);
      expect(SUMMARY_SRC).toMatch(/averageConfidence/);
    });

    it("renders the totals row with slot label + macros", () => {
      expect(SUMMARY_SRC).toMatch(/aggregateTotals/);
      expect(SUMMARY_SRC).toMatch(/Logging to/);
    });
  });
});
