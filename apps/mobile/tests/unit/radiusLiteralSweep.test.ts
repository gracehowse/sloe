/**
 * Radius literal sweep (ENG-1018) — pins high-traffic census fixes.
 *
 * Carve-outs: CARD_RADIUS / TILE_RADIUS / SHEET_RADIUS (24) stay as-is.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FILES: ReadonlyArray<{ rel: string; banned: RegExp }> = [
  {
    rel: "../../components/today/TodayMealsSection.tsx",
    banned: /borderRadius:\s*(999|10)\b/g,
  },
  {
    rel: "../../components/plan/PlanSourceSelector.tsx",
    banned: /borderRadius:\s*(999|9)\b/g,
  },
  {
    rel: "../../components/ui/SubTabPill.tsx",
    banned: /borderRadius:\s*9\b/g,
  },
  {
    rel: "../../components/today/TodayNutrientsModal.tsx",
    banned: /borderRadius:\s*10\b/g,
  },
  {
    rel: "../../components/today/TodayActivityBonusCard.tsx",
    banned: /borderRadius:\s*10\b/g,
  },
  {
    rel: "../../components/today/TodayHero.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/today/NorthStarBlock.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/today/FullNutrientPanelSheet.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/today/LogSheet.tsx",
    banned: /borderRadius:\s*14\b/g,
  },
  {
    rel: "../../components/AiLogReviewItem.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/progress/ProgressAverageAdherence.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../app/(tabs)/progress.tsx",
    banned: /borderRadius:\s*(999|10)\b/g,
  },
  // ENG-1018 token-sweep-mobile lane (2026-06-12): pill / circle / handle
  // literals migrated to Radius.full + exact-ladder tokens. The ambiguous
  // ±2 cases (planner mealIconBox r10, discover thumbnail r10, MFP icon
  // box r10, library emptySlab r20, recipe pending pill r16) stay literal
  // and are reported, NOT banned here.
  {
    rel: "../../app/(tabs)/planner.tsx",
    banned: /borderRadius:\s*(999|19|14)\b/g,
  },
  {
    rel: "../../app/(tabs)/library.tsx",
    banned: /borderRadius:\s*(15|16|28)\b/g,
  },
  {
    rel: "../../app/recipe/[id].tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/SaveMealSheet.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/CopyMealSheet.tsx",
    banned: /borderRadius:\s*(999|17)\b/g,
  },
  {
    rel: "../../components/DuplicateDaySheet.tsx",
    banned: /borderRadius:\s*17\b/g,
  },
  {
    rel: "../../components/HouseholdBar.tsx",
    banned: /borderRadius:\s*(999|11)\b/g,
  },
  {
    rel: "../../components/food-search/FoodSearchPanel.tsx",
    banned: /borderRadius:\s*(999|18)\b/g,
  },
  {
    rel: "../../components/imports/MfpCsvImportCard.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/recipe/RecipeEditSheet.tsx",
    banned: /borderRadius:\s*(999|20)\b/g,
  },
  {
    rel: "../../components/progress/ProgressOnTargetRibbon.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/progress/DigestStoryCard.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/SponsoredDisclosure.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
  {
    rel: "../../components/AiLogReviewSummary.tsx",
    banned: /borderRadius:\s*999\b/g,
  },
];

describe("radius literal sweep (ENG-1018)", () => {
  for (const { rel, banned } of FILES) {
    it(`${rel} uses Radius tokens instead of raw pill literals`, () => {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      const matches = src.match(banned) ?? [];
      expect(matches).toEqual([]);
    });
  }
});
