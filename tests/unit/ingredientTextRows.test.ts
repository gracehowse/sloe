/**
 * ENG-1611 — ingredients render as text (no icon/image tiles).
 *
 * `ingredient_text_rows_v1` ON removes the FoodFallbackThumb tiles from
 * log-sheet rows (+ skeletons) and swaps the recipe-detail tile grid for
 * the prototype's dotted-leader text rows, on BOTH platforms. OFF keeps
 * the legacy tile paths byte-intact (kill switch). Source-wiring test —
 * pattern: librarySingleFilterRow.test.ts.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

const MOBILE_ROWS = read("apps/mobile/components/today/LogSheetRows.tsx");
const MOBILE_SHEET = read("apps/mobile/components/today/LogSheet.tsx");
const WEB_ROWS = read("src/app/components/suppr/log-sheet-rows.tsx");
const WEB_SHEET = read("src/app/components/suppr/log-sheet.tsx");
const MOBILE_DETAIL = read("apps/mobile/app/recipe/[id].tsx");
const WEB_DETAIL = read("src/app/components/RecipeDetail.tsx");
const MOBILE_TEXTROWS = read("apps/mobile/components/recipe/RecipeIngredientRows.tsx");
const WEB_TEXTROWS = read("src/app/components/suppr/recipe-ingredient-text-rows.tsx");

describe("ENG-1611 — ingredient_text_rows_v1 wiring", () => {
  it("gates the log-sheet row tiles on both platforms (legacy thumb in the else)", () => {
    for (const src of [MOBILE_ROWS, WEB_ROWS]) {
      expect(src).toMatch(/ingredient_text_rows_v1/);
      // Both row components keep their FoodFallbackThumb for the OFF path.
      expect(src).toMatch(/FoodFallbackThumb/);
    }
    // Mobile: exactly the two legacy 44px thumbs survive (logSheetFoodThumb pins).
    expect(MOBILE_ROWS.match(/size=\{44\}/g)).toHaveLength(2);
  });

  it("gates both loading skeletons' leading tile block", () => {
    expect(MOBILE_SHEET).toMatch(/ingredient_text_rows_v1[\s\S]{0,400}skeletonThumb/);
    expect(WEB_SHEET).toMatch(/ingredient_text_rows_v1[\s\S]{0,400}size-9 rounded-md bg-muted/);
  });

  it("recipe detail: text rows when ON, legacy grid in the else, on both platforms", () => {
    expect(MOBILE_DETAIL).toMatch(/ingredientTextRows \? \(\s*<RecipeIngredientRows/);
    expect(MOBILE_DETAIL).toMatch(/<RecipeIngredientGrid/);
    expect(WEB_DETAIL).toMatch(/ingredientTextRows \? \(/);
    expect(WEB_DETAIL).toMatch(/<RecipeIngredientTextRows/);
    expect(WEB_DETAIL).toMatch(/grid grid-cols-3 sm:grid-cols-4/);
  });

  it("bypasses the ingredient tile-image hook (no reads / generation) when ON", () => {
    expect(MOBILE_DETAIL).toMatch(/ingredientTextRows \? EMPTY_ALIAS_SOURCES : ingredientAliasSources/);
    expect(WEB_DETAIL).toMatch(/ingredientTextRows \? EMPTY_TILE_SOURCES : ingredients/);
  });

  it("text rows carry the trust metadata forward (provenance dot; tier via label/a11y)", () => {
    // Provenance SourceDot (incl. the AI-estimated variant) survives on both.
    expect(MOBILE_TEXTROWS).toMatch(/SourceDot/);
    expect(WEB_TEXTROWS).toMatch(/SourceDot/);
    // Mobile keeps tier in the a11y label; web keeps the categorical label + Verify CTA.
    expect(MOBILE_TEXTROWS).toMatch(/accessibilityLabel=\{`\$\{displayName\} \$\{tier\}`\}/);
    expect(WEB_TEXTROWS).toMatch(/ING_TIER_LABEL/);
    expect(WEB_TEXTROWS).toMatch(/ingredientShouldShowVerifyCta/);
    // And neither renders any image/tile primitive.
    expect(MOBILE_TEXTROWS).not.toMatch(/FoodFallbackThumb|<Image|resolveIngredientTileImage/);
    expect(WEB_TEXTROWS).not.toMatch(/FoodFallbackThumb|<img|resolveIngredientTileImage/);
  });

  it("registers the flag in both KNOWN_DEFAULT_OFF_FLAGS registries (parity)", () => {
    expect(read("src/lib/analytics/track.ts")).toMatch(/"ingredient_text_rows_v1"/);
    expect(read("apps/mobile/lib/analytics.ts")).toMatch(/"ingredient_text_rows_v1"/);
  });
});
