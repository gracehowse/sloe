import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(__dirname, "../../../..");
const WEB_PANEL = join(REPO, "src/app/components/food-search/FoodSearchPanel.tsx");
const MOBILE_PANEL = join(REPO, "apps/mobile/components/food-search/FoodSearchPanel.tsx");

describe("ENG-976 learned correction trust cue wiring", () => {
  it("web FoodSearchPanel surfaces the reuse cue in preview and rows", () => {
    const src = readFileSync(WEB_PANEL, "utf8");
    expect(src).toContain("LEARNED_CUSTOM_FOOD_REUSE_CUE");
    expect(src).toContain('data-testid="learned-custom-food-cue"');
    expect(src).toContain("showLearnedReuseCue: isLearnedCustomFood(food)");
  });

  it("mobile FoodSearchPanel surfaces the reuse cue in preview and rows", () => {
    const src = readFileSync(MOBILE_PANEL, "utf8");
    expect(src).toContain("LEARNED_CUSTOM_FOOD_REUSE_CUE");
    expect(src).toContain('testID="learned-custom-food-cue"');
    expect(src).toContain("showLearnedReuseCue: isLearnedCustomFood(food)");
  });
});
