import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { formatNutritionTrustTierLabel } from "../../src/lib/nutrition/sourceLabel";

const ROOT = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");

describe("ENG-1567 — canonical nutrition trust vocabulary", () => {
  it("formats the approved five-tier ladder without touching stored identifiers", () => {
    expect(formatNutritionTrustTierLabel("verified", "USDA")).toBe("USDA");
    expect(formatNutritionTrustTierLabel("verified", "off")).toBe("Open Food Facts");
    expect(formatNutritionTrustTierLabel("verified", null)).toBe("Matched");
    expect(formatNutritionTrustTierLabel("partial")).toBe("Partial");
    expect(formatNutritionTrustTierLabel("estimated")).toBe("Estimated");
    expect(formatNutritionTrustTierLabel("manual")).toBe("Manual");
    expect(formatNutritionTrustTierLabel("unverified")).toBe("No data");
  });

  it("routes equivalent web and mobile trust surfaces through the same helper", () => {
    for (const path of [
      "src/components/NutritionSourceBadge.tsx",
      "apps/mobile/components/NutritionSourceBadge.tsx",
      "src/app/components/RecipeDetail.tsx",
      "apps/mobile/app/recipe/[id].tsx",
    ]) {
      expect(read(path), path).toContain("formatNutritionTrustTierLabel");
      expect(read(path), path).toContain('trust_source_name_v1');
    }
  });

  it("names provenance in food search and barcode confidence chips", () => {
    expect(read("src/app/components/ui/search-result-confidence-chip.tsx")).toMatch(
      /formatNutritionTrustTierLabel\(tier, sourceLabel\)/,
    );
    expect(read("src/app/components/food-search/FoodSearchResultRow.tsx")).toMatch(
      /sourceLabel=\{sourceLabel\}/,
    );
    expect(read("apps/mobile/components/food-search/FoodSearchFeedItem.tsx")).toMatch(
      /SearchResultConfidenceChip tier=\{chipTier\} sourceLabel=\{sourceLabel\}/,
    );
    expect(read("src/app/components/suppr/today-barcode-dialog.tsx")).toContain(
      'sourceLabel="Open Food Facts"',
    );
    expect(read("apps/mobile/app/(tabs)/barcode.tsx")).toMatch(
      /sourceLabel=\{barcodeTrustSourceName\(product\)\}/,
    );
    expect(read("apps/mobile/app/(tabs)/barcode.tsx")).toContain(
      "barcodeTrustProvenanceLabel(product)",
    );
  });

  it("retires Verified-only wording from the live Discover path while retaining the kill switch", () => {
    const discover = read("src/app/components/DiscoverFilterChips.tsx");
    expect(discover).toContain('"Source-backed only"');
    expect(discover).toContain('"Verified only"');
    expect(discover).toContain('trust_source_name_v1');
  });
});
