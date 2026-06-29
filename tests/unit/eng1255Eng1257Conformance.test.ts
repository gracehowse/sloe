import { describe, expect, it } from "vitest";

import { confirmFoodMacroTiles } from "../../src/lib/nutrition-core/confirmFoodMacroPreview";
import {
  importReviewBannerCopy,
  recipeIngredientsNeedReview,
} from "../../src/lib/nutrition/recipeImportReview";

describe("confirmFoodMacroPreview (ENG-1257)", () => {
  it("returns three P/C/F tiles in prototype order", () => {
    const tiles = confirmFoodMacroTiles({ proteinG: 24, carbsG: 12, fatG: 8 });
    expect(tiles.map((t) => t.key)).toEqual(["protein", "carbs", "fat"]);
    expect(tiles[0]?.valueG).toBe(24);
  });
});

describe("recipeImportReview (ENG-1247)", () => {
  it("flags low-confidence ingredient sets for review", () => {
    expect(recipeIngredientsNeedReview([{ confidence: 0.4 }])).toBe(true);
    expect(recipeIngredientsNeedReview([{ confidence: 0.9 }])).toBe(false);
  });

  it("builds import review banner copy from source name", () => {
    expect(importReviewBannerCopy({ sourceName: "TikTok" }).title).toContain("TikTok");
  });
});
