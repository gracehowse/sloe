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
    rel: "../../components/today/TodayStreakInsightCard.tsx",
    banned: /borderRadius:\s*10\b/g,
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
