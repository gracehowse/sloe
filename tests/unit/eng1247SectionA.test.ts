/**
 * ENG-1247 §A batch — source-string + pure-helper pins (A4/A5/A8/A10/A12).
 *
 * Follows the `recipeDetailV3Conformance.test.ts` idiom: structural contracts
 * without mounting 3k-line hosts.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  COMPLETE_DAY_V3_COPY,
  buildCompleteDayCoachQuote,
  completeDayTrendlinePoints,
  formatCompleteDayVsTarget,
} from "../../src/lib/completeDayV3";

const read = (rel: string) => readFileSync(resolve(__dirname, "../..", rel), "utf8");

const WEB_TRACK = read("src/lib/analytics/track.ts");
const MOBILE_ANALYTICS = read("apps/mobile/lib/analytics.ts");
const PLAN_IMPORT_WEB = read("src/app/components/PlanImport.tsx");
const PLAN_IMPORT_MOBILE = read("apps/mobile/app/plan-import.tsx");
const MEAL_NUTRITION_WEB = read("src/app/components/suppr/meal-nutrition-dialog.tsx");
const MEAL_NUTRITION_MOBILE = read("apps/mobile/app/meal-nutrition.tsx");
const COMPLETE_DAY_WEB = read("src/app/components/suppr/today-complete-day-dialog.tsx");
const COMPLETE_DAY_MOBILE = read("apps/mobile/components/today/TodayCompleteDayModal.tsx");
const MEAL_EDIT_MOBILE = read("apps/mobile/components/today/TodayEditMealModal.tsx");
const BARCODE_WEB = read("src/app/components/suppr/today-barcode-dialog.tsx");
const BARCODE_MOBILE = read("apps/mobile/app/(tabs)/barcode.tsx");
const BARCODE_SAVED_WEB = read("src/app/components/suppr/BarcodeSavedAckDialog.tsx");

describe("ENG-1247 §A — flag registration", () => {
  it("registers eng1247_section_a_v1 as default-ON on web + mobile", () => {
    for (const src of [WEB_TRACK, MOBILE_ANALYTICS]) {
      const block = src.slice(
        src.indexOf("REDESIGN_DEFAULT_ON"),
        src.indexOf("]);", src.indexOf("REDESIGN_DEFAULT_ON")),
      );
      expect(block).toContain('"eng1247_section_a_v1"');
    }
  });
});

describe("ENG-1247 §A5 — completeDayV3 helpers", () => {
  it("formats vs-target deltas", () => {
    expect(formatCompleteDayVsTarget(1800, 2000)).toEqual({ label: "−200", tone: "under" });
    expect(formatCompleteDayVsTarget(2100, 2000)).toEqual({ label: "+100", tone: "over" });
    expect(formatCompleteDayVsTarget(2000, 2000)).toEqual({ label: "On target", tone: "on" });
  });

  it("builds coach quotes and trendline points", () => {
    expect(buildCompleteDayCoachQuote({ eatenKcal: 1800, targetKcal: 2000, proteinG: 120, proteinTargetG: 150 })).toContain("protein");
    const pts = completeDayTrendlinePoints();
    expect(pts.baseline).toContain("300,30");
    expect(pts.projected).toContain("300,62");
  });

  it("exports barcode + saved copy constants", () => {
    expect(COMPLETE_DAY_V3_COPY.barcodeNotFoundBody).toContain("saved for you");
    expect(COMPLETE_DAY_V3_COPY.sharedAnonymouslyNote).toContain("Shared anonymously");
    expect(COMPLETE_DAY_V3_COPY.savedThanks("Oat milk")).toContain("Oat milk");
  });
});

describe("ENG-1247 §A10 — PlanImport token snaps", () => {
  it("web uses success-soft + section-label tokens", () => {
    expect(PLAN_IMPORT_WEB).toContain("bg-success-soft");
    expect(PLAN_IMPORT_WEB).toContain("section-label");
  });

  it("mobile uses Type.label/caption + on-scale Radius (no Radius.xl * 2)", () => {
    expect(PLAN_IMPORT_MOBILE).toMatch(/Type\.(label|caption)/);
    expect(PLAN_IMPORT_MOBILE).toContain("Radius.lg");
    expect(PLAN_IMPORT_MOBILE).not.toContain("Radius.xl * 2");
  });
});

describe("ENG-1247 §A4 — MealDetail serif grammar", () => {
  it("gates overline meta + hides split bar when section A is on (web)", () => {
    expect(MEAL_NUTRITION_WEB).toContain('isFeatureEnabled("eng1247_section_a_v1")');
    expect(MEAL_NUTRITION_WEB).toContain('data-testid="meal-nutrition-meta-overline"');
    expect(MEAL_NUTRITION_WEB).toContain("!sectionA ?");
    expect(MEAL_NUTRITION_WEB).toContain("MacroTotalGrid");
  });

  it("gates overline meta + hides macro bar when section A is on (mobile)", () => {
    expect(MEAL_NUTRITION_MOBILE).toContain('isFeatureEnabled("eng1247_section_a_v1")');
    expect(MEAL_NUTRITION_MOBILE).toContain("metaOverline");
    expect(MEAL_NUTRITION_MOBILE).toContain("!sectionA");
  });
});

describe("ENG-1247 §A5 — CompleteDay v3 section", () => {
  it("gates CompleteDayV3Section behind the flag on web + mobile", () => {
    expect(COMPLETE_DAY_WEB).toContain('isFeatureEnabled("eng1247_section_a_v1")');
    expect(COMPLETE_DAY_WEB).toContain("CompleteDayV3Section");
    expect(COMPLETE_DAY_MOBILE).toContain('isFeatureEnabled("eng1247_section_a_v1")');
    expect(COMPLETE_DAY_MOBILE).toContain("CompleteDayV3Section");
  });
});

describe("ENG-1247 §A8 — MealEdit mobile expander rows", () => {
  it("surfaces Full nutrition / Swap / Copy rows when section A is on", () => {
    expect(MEAL_EDIT_MOBILE).toContain("onOpenFullNutrition");
    expect(MEAL_EDIT_MOBILE).toContain("onSwapFood");
    expect(MEAL_EDIT_MOBILE).toContain("onCopyMeal");
    expect(MEAL_EDIT_MOBILE).toContain("sectionA ?");
  });
});

describe("ENG-1247 §A6 — WhyNumber v3 section", () => {
  const WHY_WEB = read("src/app/components/suppr/why-this-number-dialog.tsx");
  const WHY_MOBILE = read("apps/mobile/components/today/WhyThisNumberSheet.tsx");
  const WHY_V3_WEB = read("src/app/components/suppr/WhyNumberV3Section.tsx");
  const WHY_V3_MOBILE = read("apps/mobile/components/today/WhyNumberV3Section.tsx");
  const WHY_LIB = read("src/lib/whyNumberV3.ts");

  it("gates v3 grammar behind eng1247_section_a_v1 on web + mobile", () => {
    expect(WHY_WEB).toContain('isFeatureEnabled("eng1247_section_a_v1")');
    expect(WHY_WEB).toContain("WhyNumberV3Section");
    expect(WHY_MOBILE).toContain('isFeatureEnabled("eng1247_section_a_v1")');
    expect(WHY_MOBILE).toContain("WhyNumberV3Section");
  });

  it("ships Keep this target CTA + serif hero in v3 section", () => {
    expect(WHY_LIB).toContain("keepThisTarget");
    expect(WHY_V3_WEB).toContain("why-number-keep-target");
    expect(WHY_V3_MOBILE).toContain("why-number-keep-target");
    expect(WHY_V3_WEB).toContain("why-number-hero-kcal");
  });
});

describe("ENG-1247 §A7 — Verify flush list + leading ver-dot", () => {
  const VERIFY = read("apps/mobile/app/recipe/verify.tsx");

  it("uses flush divided ingredient list with leading ver-dot", () => {
    expect(VERIFY).toContain("verify-ingredient-flush-list");
    expect(VERIFY).toContain("verify-ingredient-ver-dot");
    expect(VERIFY).toContain("ingRowDivider");
  });
});

describe("ENG-1247 B15–B16 — ImportFlow affordances", () => {
  const IMPORT_WEB = read("src/app/components/suppr/unified-import-sheet.tsx");
  const IMPORT_MOBILE = read("apps/mobile/components/import/UnifiedImportSheet.tsx");

  it("adds clear (×) on multiline paste when text is present", () => {
    expect(IMPORT_WEB).toContain("unified-import-clear");
    expect(IMPORT_MOBILE).toContain("unified-import-clear");
  });

  it("verify review banner uses import review grammar (B16)", () => {
    expect(read("apps/mobile/app/recipe/verify.tsx")).toContain("verify-import-review-banner");
    expect(read("apps/mobile/app/recipe/verify.tsx")).toContain("importReviewBannerCopy");
  });
});

describe("ENG-1247 §A12 — Barcode community copy + saved state", () => {
  it("web not-found + saved ack dialog use v3 copy when flag is on", () => {
    expect(BARCODE_WEB).toContain("COMPLETE_DAY_V3_COPY.barcodeNotFoundTitle");
    expect(BARCODE_SAVED_WEB).toContain("COMPLETE_DAY_V3_COPY.savedTitle");
    expect(BARCODE_SAVED_WEB).toContain("Log it now");
  });

  it("mobile not-found, bc-chip, shared note, and saved ack overlay", () => {
    expect(BARCODE_MOBILE).toContain("COMPLETE_DAY_V3_COPY.barcodeNotFoundTitle");
    expect(BARCODE_MOBILE).toContain("bcChip");
    expect(BARCODE_MOBILE).toContain("sharedAnonymouslyNote");
    expect(BARCODE_MOBILE).toContain('testID="barcode-saved-title"');
  });
});
