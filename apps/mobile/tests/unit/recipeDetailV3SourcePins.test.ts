/**
 * 2026-05-01 v3 redesign — mobile source-pin parity for the
 * recipe-detail rewrite.
 *
 * `apps/mobile/app/recipe/[id].tsx` is a 2k+ LOC component wired to
 * Supabase, expo-router, planner deeplinks, cook mode, and a stack of
 * sub-dialogs — mounting it for an isolated layout assertion would
 * require a sandbox of mocks. We pin the v3 structural contract via
 * source-string regex (matches the existing `screenAuditFixesParity`
 * idiom).
 *
 * If this test breaks, the recipe-detail v3 redesign has regressed
 * on mobile.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MOBILE_RECIPE = resolve(__dirname, "../../app/recipe/[id].tsx");
const SRC = readFileSync(MOBILE_RECIPE, "utf8");

describe("mobile recipe-detail v3 — Fix 1 (subtitle merge + kcal inline)", () => {
  it("composeSubtitleParts is called with kcal arg (v3 inline kcal)", () => {
    expect(SRC).toMatch(
      /composeSubtitleParts\(\{[\s\S]*?kcal:\s*kcalForSubtitle[\s\S]*?\}\)/,
    );
    // Source of the kcal value: the `macros.calories` aggregate
    // (rounded to integer so we never render `329.4 kcal`).
    expect(SRC).toMatch(/const\s+kcalForSubtitle\s*=\s*Math\.round\(macros\.calories\)/);
  });

  it("subtitle renders a `recipe-subtitle-kcal` testID for the kcal token", () => {
    expect(SRC).toMatch(/"recipe-subtitle-kcal"/);
    // Mounted only on the kcal part — gated by `part.key === "kcal"`.
    expect(SRC).toMatch(
      /part\.key === "kcal" \? "recipe-subtitle-kcal" : undefined/,
    );
  });

  it("subtitle kcal token uses subtitleTextStrong style (bold + foreground)", () => {
    expect(SRC).toMatch(/subtitleTextStrong/);
    expect(SRC).toMatch(
      /subtitleTextStrong:\s*\{[^}]*fontWeight:\s*"700"[^}]*color:\s*colors\.text/,
    );
  });
});

describe("mobile recipe-detail v3 — Fix 2 (compact time stats — preserved)", () => {
  it("time-stats row is gated by shouldRenderTimeStats", () => {
    expect(SRC).toMatch(/shouldRenderTimeStats\(/);
    expect(SRC).toMatch(/testID="recipe-time-stats"/);
  });

  it("compact form renders `<X> prep · <Y> cook`, not 4-tile icon-circle row", () => {
    expect(SRC).toMatch(/\$\{formatMinutes\(prepMin\)\}\s*prep/);
    expect(SRC).toMatch(/\$\{formatMinutes\(cookMin\)\}\s*cook/);
  });

  it("the old icon-circle infoRow style is gone", () => {
    expect(SRC).not.toMatch(/infoRow:\s*\{\s*flexDirection:\s*"row",\s*justifyContent:\s*"space-around"/);
    expect(SRC).not.toMatch(/<View style=\{styles\.infoRow\}/);
  });
});

describe("mobile recipe-detail v3 — Fix 3 (kcal hero card removed)", () => {
  it("the bordered kcal hero card is gone — no `recipe-calorie-hero` testID", () => {
    expect(SRC).not.toMatch(/testID="recipe-calorie-hero"/);
  });

  it("the dimmed pending placeholder has its own testID", () => {
    expect(SRC).toMatch(/testID="recipe-nutrition-pending"/);
    expect(SRC).toMatch(/Calories not yet computed[^"]*open the Ingredients tab/);
  });

  it("the hero `MacroColors.calories + \"55\"` border treatment is gone", () => {
    // The only remaining MacroColors.calories reference should be the
    // macro-tile fiber tint (which uses the calories token as a proxy
    // colour). The bordered hero with "55" alpha border is gone.
    expect(SRC).not.toMatch(
      /borderColor:\s*hasNutrition\s*\?\s*MacroColors\.calories\s*\+\s*"55"/,
    );
  });
});

describe("mobile recipe-detail v3 — Fix 4 (macros are the visual hero)", () => {
  it("the macros grid carries `recipe-macros-grid` testID", () => {
    expect(SRC).toMatch(/testID="recipe-macros-grid"/);
  });

  it("macro tiles use the v3 bigger-numeral treatment (fontSize: 20, padding: 14)", () => {
    // The pre-v3 tile rendered the value at `fontSize: 16`, padding
    // 10. v3 lifts to fontSize 20, padding 14, fontWeight 800.
    expect(SRC).toMatch(/fontSize:\s*20,\s*fontWeight:\s*"800"/);
    expect(SRC).toMatch(/padding:\s*14,\s*borderRadius:\s*14/);
  });
});

describe("mobile recipe-detail v3 — Fix 5 (Fits your day softened)", () => {
  it("verdict logic delegates to the shared `computeFitsYourDayVerdict` helper", () => {
    expect(SRC).toMatch(/computeFitsYourDayVerdict\(\{/);
  });

  it("fits-your-day testID still exists, rendered as a plain text line (no pill bg)", () => {
    expect(SRC).toMatch(/testID="recipe-fits-your-day"/);
    // No background-color rounded-pill — the pre-v3 mobile pill used
    // a `verdictTone.bg` `+"1A"` alpha background. v3 drops that.
    const fitsIdx = SRC.indexOf('testID="recipe-fits-your-day"');
    expect(fitsIdx).toBeGreaterThan(0);
    const block = SRC.slice(fitsIdx, fitsIdx + 1200);
    expect(block).not.toMatch(/borderRadius:\s*Radius\.full,\s*backgroundColor:/);
  });
});

describe("mobile recipe-detail v3 — Fix 6 (calorieNumber style retired at call site)", () => {
  it("the legacy `calorieNumber` 26-pt extra-bold style is unused at the call site", () => {
    // The style itself can stay in the StyleSheet (other stale
    // entries do — refactor scope is layout, not StyleSheet
    // grooming), but the JSX must not reference it any more.
    expect(SRC).not.toMatch(/<Text\s+style=\{\[styles\.calorieNumber/);
  });
});
