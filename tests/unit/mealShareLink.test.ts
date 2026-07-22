import { describe, expect, it } from "vitest";
import {
  buildMealShareUrl,
  deriveMealShareRowState,
  mealShareTotals,
  mealToShareItem,
  normaliseMealShareToken,
  parseMealShareLookup,
  shareItemToLoggableMeal,
  type MealShareItem,
  type MealShareListRow,
  type ShareableLoggedMeal,
} from "@/lib/share/mealShareLink";

function meal(overrides: Partial<ShareableLoggedMeal> = {}): ShareableLoggedMeal {
  return {
    recipeTitle: "Chicken salad",
    calories: 420,
    protein: 38,
    carbs: 20,
    fat: 18,
    fiberG: 7,
    waterMl: 250,
    portionMultiplier: 1.5,
    micros: { sugarG: 12, sodiumMg: 300 },
    source: "USDA",
    recipeId: "11111111-1111-1111-1111-111111111111",
    ...overrides,
  };
}

describe("mealToShareItem -> parseMealShareLookup round trip", () => {
  it("serializes a full meal and parses it back through an ok envelope", () => {
    const wire = mealToShareItem(meal());
    expect(wire).not.toBeNull();

    const lookup = parseMealShareLookup({
      status: "ok",
      title: "Lunch on the go",
      meal_slot: "Lunch",
      items: [wire],
      shared_by: "Grace",
      created_at: "2026-07-22T09:00:00Z",
    });

    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") throw new Error("expected ok");
    expect(lookup.payload.title).toBe("Lunch on the go");
    expect(lookup.payload.mealSlot).toBe("Lunch");
    expect(lookup.payload.sharedBy).toBe("Grace");
    expect(lookup.payload.createdAt).toBe("2026-07-22T09:00:00Z");
    expect(lookup.payload.items).toHaveLength(1);
    expect(lookup.payload.items[0]).toEqual<MealShareItem>({
      recipeTitle: "Chicken salad",
      calories: 420,
      protein: 38,
      carbs: 20,
      fat: 18,
      fiberG: 7,
      waterMl: 250,
      portionMultiplier: 1.5,
      nutritionMicros: { sugarG: 12, sodiumMg: 300 },
      source: "USDA",
      recipeId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("round-trips a minimal meal carrying only the four required macros", () => {
    const wire = mealToShareItem({
      recipeTitle: "Rice",
      calories: 200,
      protein: 4,
      carbs: 44,
      fat: 1,
    });
    const lookup = parseMealShareLookup({
      status: "ok",
      title: "Dinner",
      meal_slot: "Dinner",
      items: [wire],
    });

    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") throw new Error("expected ok");
    expect(lookup.payload.items[0]).toEqual({
      recipeTitle: "Rice",
      calories: 200,
      protein: 4,
      carbs: 44,
      fat: 1,
    });
    expect(lookup.payload.sharedBy).toBeNull();
    expect(lookup.payload.createdAt).toBeNull();
  });
});

describe("mealToShareItem — junk rejection", () => {
  it("returns null when a required macro is missing", () => {
    expect(
      mealToShareItem({
        recipeTitle: "X",
        calories: 100,
        protein: 1,
        carbs: 1,
      } as unknown as ShareableLoggedMeal),
    ).toBeNull();
  });

  it("returns null when a macro is non-numeric", () => {
    expect(
      mealToShareItem({
        recipeTitle: "X",
        calories: "100" as unknown as number,
        protein: 1,
        carbs: 1,
        fat: 1,
      }),
    ).toBeNull();
  });

  it("returns null when a macro is NaN or Infinity", () => {
    expect(
      mealToShareItem({ recipeTitle: "X", calories: NaN, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      mealToShareItem({ recipeTitle: "X", calories: Infinity, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
  });

  it("returns null for an empty or whitespace-only title", () => {
    expect(
      mealToShareItem({ recipeTitle: "   ", calories: 100, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
    expect(
      mealToShareItem({ recipeTitle: "", calories: 100, protein: 1, carbs: 1, fat: 1 }),
    ).toBeNull();
  });
});

describe("parseMealShareLookup — junk rejection", () => {
  it("collapses to invalid when data is not a plain object", () => {
    expect(parseMealShareLookup(null)).toEqual({ status: "invalid" });
    expect(parseMealShareLookup("nope")).toEqual({ status: "invalid" });
    expect(parseMealShareLookup([1, 2])).toEqual({ status: "invalid" });
    expect(parseMealShareLookup(undefined)).toEqual({ status: "invalid" });
  });

  it("passes expired/revoked straight through", () => {
    expect(parseMealShareLookup({ status: "expired" })).toEqual({ status: "expired" });
    expect(parseMealShareLookup({ status: "revoked" })).toEqual({ status: "revoked" });
  });

  it("collapses an unrecognised status to invalid", () => {
    expect(parseMealShareLookup({ status: "banana" })).toEqual({ status: "invalid" });
  });

  it("collapses an ok payload with zero parseable items to invalid", () => {
    const lookup = parseMealShareLookup({
      status: "ok",
      title: "Lunch",
      meal_slot: "Lunch",
      items: [{ recipe_title: "", calories: 1, protein: 1, carbs: 1, fat: 1 }],
    });
    expect(lookup).toEqual({ status: "invalid" });
  });

  it("collapses an ok payload with a missing title or meal_slot to invalid", () => {
    expect(
      parseMealShareLookup({
        status: "ok",
        title: "",
        meal_slot: "Lunch",
        items: [{ recipe_title: "X", calories: 1, protein: 1, carbs: 1, fat: 1 }],
      }),
    ).toEqual({ status: "invalid" });
    expect(
      parseMealShareLookup({
        status: "ok",
        title: "Lunch",
        meal_slot: "",
        items: [{ recipe_title: "X", calories: 1, protein: 1, carbs: 1, fat: 1 }],
      }),
    ).toEqual({ status: "invalid" });
  });
});

describe("micros filtering (non-finite dropped)", () => {
  it("drops non-finite micro values in mealToShareItem's output", () => {
    const wire = mealToShareItem(
      meal({
        micros: {
          sugarG: 12,
          bad: NaN,
          alsoBad: Infinity,
          negInf: -Infinity,
          notANumber: "5" as unknown as number,
        },
      }),
    )!;
    expect(wire.nutrition_micros).toEqual({ sugarG: 12 });
  });

  it("drops the nutrition_micros key entirely when nothing survives", () => {
    const wire = mealToShareItem(meal({ micros: { bad: NaN } }))!;
    expect(wire.nutrition_micros).toBeUndefined();
  });

  it("drops non-finite micro values on the parse side too", () => {
    const lookup = parseMealShareLookup({
      status: "ok",
      title: "Lunch",
      meal_slot: "Lunch",
      items: [
        {
          recipe_title: "X",
          calories: 1,
          protein: 1,
          carbs: 1,
          fat: 1,
          nutrition_micros: { sugarG: 12, bad: NaN, worse: Infinity },
        },
      ],
    });
    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") throw new Error("expected ok");
    expect(lookup.payload.items[0]!.nutritionMicros).toEqual({ sugarG: 12 });
  });

  // MICRO_VALUE_MAX mirrors the SQL whitelist's per-micro bound
  // (`between 0 and 100000` inside the create_meal_share jsonb_each filter,
  // pinned in eng1642MealShareMigration.test.ts) — a value outside [0, 100000]
  // must be dropped client-side too, on BOTH the serialize and parse sides.
  it("mealToShareItem drops negative and >100000 micro values, keeps in-bounds values (0 and 100000 inclusive)", () => {
    const wire = mealToShareItem(
      meal({
        micros: {
          negative: -1,
          tooBig: 100001,
          zeroIsFine: 0,
          maxIsFine: 100000,
          sugarG: 12,
        },
      }),
    )!;
    expect(wire.nutrition_micros).toEqual({ zeroIsFine: 0, maxIsFine: 100000, sugarG: 12 });
  });

  it("parseMealShareLookup drops negative and >100000 micro values on the wire-parse side", () => {
    const lookup = parseMealShareLookup({
      status: "ok",
      title: "Lunch",
      meal_slot: "Lunch",
      items: [
        {
          recipe_title: "X",
          calories: 1,
          protein: 1,
          carbs: 1,
          fat: 1,
          nutrition_micros: {
            negative: -1,
            tooBig: 100001,
            zeroIsFine: 0,
            maxIsFine: 100000,
            sugarG: 12,
          },
        },
      ],
    });
    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") throw new Error("expected ok");
    expect(lookup.payload.items[0]!.nutritionMicros).toEqual({
      zeroIsFine: 0,
      maxIsFine: 100000,
      sugarG: 12,
    });
  });

  it("drops the nutrition_micros key entirely when every value is out of bounds", () => {
    const wire = mealToShareItem(meal({ micros: { negative: -5, tooBig: 999999 } }))!;
    expect(wire.nutrition_micros).toBeUndefined();
  });
});

describe("shareItemToLoggableMeal", () => {
  it("has no eatenAt key and sets name to the slot, time to the label", () => {
    const item: MealShareItem = {
      recipeTitle: "Chicken salad",
      calories: 420,
      protein: 38,
      carbs: 20,
      fat: 18,
    };
    const loggable = shareItemToLoggableMeal(item, "Dinner", "18:45");
    expect(loggable.name).toBe("Dinner");
    expect(loggable.time).toBe("18:45");
    expect(loggable.recipeTitle).toBe("Chicken salad");
    expect(loggable.calories).toBe(420);
    expect("eatenAt" in loggable).toBe(false);
  });

  it("carries optional fields through only when present on the source item", () => {
    const item: MealShareItem = {
      recipeTitle: "X",
      calories: 1,
      protein: 1,
      carbs: 1,
      fat: 1,
      fiberG: 2,
      waterMl: 3,
      portionMultiplier: 1.2,
      nutritionMicros: { a: 1 },
      source: "USDA",
      recipeId: "abc",
    };
    const loggable = shareItemToLoggableMeal(item, "Breakfast", "08:00");
    expect(loggable.fiberG).toBe(2);
    expect(loggable.waterMl).toBe(3);
    expect(loggable.portionMultiplier).toBe(1.2);
    expect(loggable.micros).toEqual({ a: 1 });
    expect(loggable.source).toBe("USDA");
    expect(loggable.recipeId).toBe("abc");
    expect("eatenAt" in loggable).toBe(false);
  });

  it("omits optional keys entirely when absent from the source item", () => {
    const item: MealShareItem = {
      recipeTitle: "X",
      calories: 1,
      protein: 1,
      carbs: 1,
      fat: 1,
    };
    const loggable = shareItemToLoggableMeal(item, "Snacks", "14:00");
    expect("fiberG" in loggable).toBe(false);
    expect("waterMl" in loggable).toBe(false);
    expect("portionMultiplier" in loggable).toBe(false);
    expect("micros" in loggable).toBe(false);
    expect("source" in loggable).toBe(false);
    expect("recipeId" in loggable).toBe(false);
  });
});

describe("mealShareTotals", () => {
  it("sums calories/protein/carbs/fat across items", () => {
    const items: MealShareItem[] = [
      { recipeTitle: "A", calories: 100, protein: 5, carbs: 10, fat: 2 },
      { recipeTitle: "B", calories: 200, protein: 15, carbs: 20, fat: 8 },
    ];
    expect(mealShareTotals(items)).toEqual({ calories: 300, protein: 20, carbs: 30, fat: 10 });
  });

  it("returns zeros for an empty list", () => {
    expect(mealShareTotals([])).toEqual({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  });
});

describe("normaliseMealShareToken", () => {
  it("accepts a valid 32-hex token unchanged", () => {
    expect(normaliseMealShareToken("a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4")).toBe(
      "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
  });

  it("lowercases uppercase input and strips hyphens", () => {
    expect(normaliseMealShareToken("A1B2-C3D4-A1B2-C3D4-A1B2-C3D4-A1B2-C3D4")).toBe(
      "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
  });

  it("returns null for the wrong length", () => {
    expect(normaliseMealShareToken("a1b2c3")).toBeNull();
    expect(normaliseMealShareToken("a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d40")).toBeNull();
    expect(normaliseMealShareToken("")).toBeNull();
  });

  it("strips non-hex characters before measuring length", () => {
    // 'g' is stripped, leaving 31 hex chars -> invalid length -> null.
    expect(normaliseMealShareToken("g1b2c3d4e5f60718293a4b5c6d7e8f90")).toBeNull();
  });
});

describe("buildMealShareUrl", () => {
  it("builds the /m/<token> URL", () => {
    expect(buildMealShareUrl("a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4", "https://getsloe.com")).toBe(
      "https://getsloe.com/m/a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
  });

  it("strips a trailing slash from the origin", () => {
    expect(buildMealShareUrl("a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4", "https://getsloe.com/")).toBe(
      "https://getsloe.com/m/a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4",
    );
  });
});

describe("deriveMealShareRowState (ENG-1648)", () => {
  const NOW = new Date("2026-07-22T12:00:00Z");

  function row(overrides: Partial<Pick<MealShareListRow, "expiresAt" | "revokedAt">> = {}) {
    return {
      expiresAt: "2026-08-01T00:00:00Z", // future relative to NOW by default
      revokedAt: null as string | null,
      ...overrides,
    };
  }

  it("is 'active' when not revoked and expiry is in the future", () => {
    expect(deriveMealShareRowState(row(), NOW)).toBe("active");
  });

  it("is 'expired' when not revoked and expiry is in the past", () => {
    expect(deriveMealShareRowState(row({ expiresAt: "2026-07-01T00:00:00Z" }), NOW)).toBe(
      "expired",
    );
  });

  it("treats expiry exactly equal to now as expired (inclusive boundary)", () => {
    expect(
      deriveMealShareRowState(row({ expiresAt: "2026-07-22T12:00:00Z" }), NOW),
    ).toBe("expired");
  });

  it("is 'revoked' when revokedAt is set, regardless of expiry", () => {
    expect(
      deriveMealShareRowState(
        row({ expiresAt: "2026-08-01T00:00:00Z", revokedAt: "2026-07-20T00:00:00Z" }),
        NOW,
      ),
    ).toBe("revoked");
  });

  it("revoked wins over expired when both are true", () => {
    expect(
      deriveMealShareRowState(
        row({ expiresAt: "2026-07-01T00:00:00Z", revokedAt: "2026-07-05T00:00:00Z" }),
        NOW,
      ),
    ).toBe("revoked");
  });
});
