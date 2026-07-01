/**
 * GROW-61 (recipe-import audit, 2026-07-01) — mobile side of the import-success
 * quality signal. Two invariants:
 *
 *  1. Mobile derives the SAME `macro_complete` + `ingredient_match_rate` props
 *     from the SAME shared module the web path uses (resolved here via the
 *     `@suppr/shared/recipes/importQualitySignal` alias — the exact specifier
 *     `import-shared.tsx` imports). If web and mobile ever diverge on the
 *     derivation, this fails.
 *
 *  2. `import-shared.tsx` actually fires `recipe_imported` when the review
 *     renders a result, carrying the quality props. RNTL cannot render the
 *     ~3k-line import screen (Modal + KeyboardAvoidingView + share-sheet
 *     drivers), so — like `aiLogReviewParity.test.ts` — this is a source-grep
 *     wiring assertion: it breaks if the emit is removed or the props stop
 *     being spread. The audit's FM-4 was precisely that this event fired only
 *     on web and nowhere in mobile.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { importQualityProps } from "@suppr/shared/recipes/importQualitySignal";

const IMPORT_SHARED = readFileSync(
  resolve(__dirname, "../../app/import-shared.tsx"),
  "utf8",
);

describe("mobile import-quality derivation parity", () => {
  it("produces the same props as the shared web derivation", () => {
    const recipe = {
      calories: 520,
      ingredientMacros: [
        { source: "USDA", calories: 100 },
        { source: "OFF", calories: 90 },
        { source: "Unverified", calories: 0 },
      ],
    };
    // 2 matched of 3 → 0.667, macro spine present.
    expect(importQualityProps(recipe)).toEqual({
      macro_complete: true,
      ingredient_match_rate: 0.667,
    });
  });

  it("scores the FM-2 zero-macro shell as not macro-complete", () => {
    expect(
      importQualityProps({ calories: 0, ingredientMacros: [{ source: "Unverified", calories: 0 }] }),
    ).toEqual({ macro_complete: false, ingredient_match_rate: 0 });
  });
});

describe("import-shared.tsx wiring (FM-4 — event was mobile-missing)", () => {
  it("imports the shared quality signal", () => {
    expect(IMPORT_SHARED).toContain(
      'import { importQualityProps, isFlaggedIngredientRow } from "@suppr/shared/recipes/importQualitySignal"',
    );
  });

  it("fires recipe_imported when the review renders a result", () => {
    expect(IMPORT_SHARED).toContain("track(AnalyticsEvents.recipe_imported");
  });

  it("spreads the derived quality props into the recipe_imported payload", () => {
    // The emit and the props spread must co-occur in the same call.
    const emitIdx = IMPORT_SHARED.indexOf("track(AnalyticsEvents.recipe_imported");
    expect(emitIdx).toBeGreaterThan(-1);
    const emitBlock = IMPORT_SHARED.slice(emitIdx, emitIdx + 400);
    expect(emitBlock).toContain("...importQualityProps(normalized)");
    expect(emitBlock).toContain("platform:");
  });
});
