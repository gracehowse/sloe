// @vitest-environment node
/**
 * ENG-943 mobile parity pin. The "Add to shopping list from a recipe" action
 * must run off the SAME shared aggregator the web RecipeDetail uses — no
 * reinvented merge/count-to-weight math on mobile. Importing through
 * `@suppr/shared/planning/appendRecipeToShoppingList` proves the alias resolves
 * and the mobile build gets identical aggregation, dedup, and the
 * never-guess-a-weight low-confidence fallback.
 *
 * Also pins the `recipe_shopping_list_v1` flag default-ON (un-gated) on mobile,
 * mirroring `src/lib/analytics/track.ts` (asserted web-side in
 * `tests/unit/redesignDefaultOnParity.test.ts`).
 */
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.EXPO_PUBLIC_POSTHOG_KEY = "phc_mobile_test_key";
});

vi.mock("posthog-react-native", () => {
  class FakePostHog {
    // Resolve every flag OFF — un-gated default-ON flags must still be true.
    isFeatureEnabled(): boolean {
      return false;
    }
    capture(): void {}
    identify(): void {}
    getDistinctId(): string {
      return "anon";
    }
    reset(): void {}
    reloadFeatureFlagsAsync(): Promise<void> {
      return Promise.resolve();
    }
  }
  return { default: FakePostHog };
});

import {
  appendRecipeToShoppingList,
  buildingYourListMessage,
} from "@suppr/shared/planning/appendRecipeToShoppingList";
import { isFeatureEnabled } from "../../lib/analytics";

describe("ENG-943 mobile — shared recipe→shopping-list aggregator", () => {
  it("merges duplicates silently across the list (same ingredient + unit)", () => {
    const res = appendRecipeToShoppingList({
      existing: [
        {
          id: "row-1",
          name: "rice",
          amount: "200",
          unit: "g",
          category: "Grains",
          checked: false,
          from: "Plan",
        },
      ],
      recipeTitle: "Pilaf",
      ingredients: [{ name: "rice", amount: "150", unit: "g" }],
    });
    expect(res.mergedCount).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.amount).toBe("350");
    expect(res.items[0]?.from).toContain("Pilaf");
  });

  it("does NOT guess a weight on a low-confidence count (keeps a separate row)", () => {
    const res = appendRecipeToShoppingList({
      existing: [
        {
          id: "row-1",
          name: "widget",
          amount: "100",
          unit: "g",
          category: "Other",
          checked: false,
          from: "Plan",
        },
      ],
      recipeTitle: "Mystery",
      ingredients: [{ name: "widget", amount: "2", unit: "" }],
    });
    expect(res.addedCount).toBe(1);
    expect(res.items).toHaveLength(2);
    expect(res.items.find((i) => i.unit === "g")?.amount).toBe("100");
  });

  it("uses the calm 'building your list' framing", () => {
    const msg = buildingYourListMessage({ items: [], ingredientCount: 2, addedCount: 2, mergedCount: 0 });
    expect(msg).toBe("Added 2 ingredients to your shopping list.");
  });
});

describe("ENG-943 mobile — flag default-ON parity", () => {
  it("recipe_shopping_list_v1 resolves ON even with PostHog OFF (un-gated)", () => {
    vi.unstubAllGlobals(); // not __DEV__ → dev-force branch skipped
    expect(isFeatureEnabled("recipe_shopping_list_v1")).toBe(true);
  });
});
