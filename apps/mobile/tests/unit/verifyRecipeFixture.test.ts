import { describe, expect, it } from "vitest";

import {
  VERIFY_FIXTURE_INGREDIENTS,
  VERIFY_FIXTURE_RECIPE,
} from "@/lib/verifyRecipeFixture";

describe("verifyRecipeFixture (ENG-1066 agent path)", () => {
  it("seeds matched ingredient rows for the verify fixture deeplink", () => {
    expect(VERIFY_FIXTURE_RECIPE.servings).toBeGreaterThan(0);
    expect(VERIFY_FIXTURE_INGREDIENTS.length).toBeGreaterThanOrEqual(3);
    for (const row of VERIFY_FIXTURE_INGREDIENTS) {
      expect(row.matchedName).toBeTruthy();
      expect(row.confidence).toBeGreaterThan(0);
    }
  });
});
