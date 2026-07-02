/**
 * northStarSuggestion — pins the single-recipe scorer behind the
 * Today north-star block.
 *
 * Authority: D-2026-04-27-04 (north-star moment).
 * Source: src/lib/nutrition/northStarSuggestion.ts
 *
 * What's pinned:
 *   - `pickNorthStarSuggestion` returns null when:
 *     - library is empty
 *     - remaining calories <= 0 (over-budget — caller renders calm caption)
 *     - all candidates are excluded
 *   - Returns the closest-fit recipe at its ACTUAL single serving.
 *   - Asymmetric calorie penalty (over > under).
 *   - Slot filter excludes recipes whose mealType doesn't match.
 *   - `detectSlotForHour` time-of-day branching matches spec §A-northstar.
 *   - `ctaForSlot` returns the spec copy for each slot.
 *   - `bandLabel` returns the spec copy for each band.
 *   - `NORTH_STAR_LIBRARY_MIN === 5` and `isLibraryEligibleForNorthStar`
 *     gates correctly (V-6 default).
 *
 * ENG-995 rebuild (2026-06-08) — three load-bearing correctness pins:
 *   (a) a 573-kcal/serving recipe suggestion shows 573 (one serving),
 *       identical to the recipe detail — no portion scaling;
 *   (b) with a large morning `remaining`, the per-meal target is a
 *       meal-sized share of the day (~slotShare · dayTarget), NOT the
 *       whole day, and the chosen recipe is a sensible single meal;
 *   (c) the suggestion is never more than one serving (portionMultiplier
 *       is always 1).
 */

import { describe, it, expect } from "vitest";

import {
  pickNorthStarSuggestion,
  pickNextNorthStarSuggestion,
  detectSlotForHour,
  ctaForSlot,
  bandLabel,
  whyLineForSuggestion,
  NORTH_STAR_LIBRARY_MIN,
  NORTH_STAR_LIBRARY_MIN_ACTIVATION,
  NORTH_STAR_ACTIVATION_WINDOW_DAYS,
  NORTH_STAR_SLOT_SHARE,
  NORTH_STAR_NO_SLOT_SHARE,
  isLibraryEligibleForNorthStar,
  isWithinNorthStarActivationWindow,
  type NorthStarRecipe,
  type NorthStarRemaining,
} from "../../src/lib/nutrition/northStarSuggestion";

const mkRecipe = (over: Partial<NorthStarRecipe> = {}): NorthStarRecipe => ({
  id: over.id ?? "r1",
  title: over.title ?? "Test recipe",
  calories: over.calories ?? 500,
  protein: over.protein ?? 30,
  carbs: over.carbs ?? 50,
  fat: over.fat ?? 18,
  thumbnail: over.thumbnail,
  mealType: over.mealType,
});

/**
 * Build a `NorthStarRemaining`. ENG-995 added the required
 * `dailyCalorieTarget` field; this helper defaults it to the remaining
 * calories so legacy tests that model "the whole remaining day is the
 * meal budget" (no slot) keep their exact semantics. Tests that need a
 * morning-with-a-full-day case pass `dailyCalorieTarget` explicitly.
 */
const rem = (
  r: Omit<NorthStarRemaining, "dailyCalorieTarget"> &
    Partial<Pick<NorthStarRemaining, "dailyCalorieTarget">>,
): NorthStarRemaining => ({
  ...r,
  dailyCalorieTarget: r.dailyCalorieTarget ?? r.calories,
});

describe("pickNorthStarSuggestion", () => {
  it("returns null on empty library", () => {
    const result = pickNorthStarSuggestion([], rem({ calories: 800, protein: 40, carbs: 100, fat: 30 }));
    expect(result).toBeNull();
  });

  it("returns null when remaining calories <= 0 (over-budget signal)", () => {
    const result = pickNorthStarSuggestion(
      [mkRecipe()],
      rem({ calories: 0, protein: 40, carbs: 100, fat: 30 }),
    );
    expect(result).toBeNull();

    const result2 = pickNorthStarSuggestion(
      [mkRecipe()],
      rem({ calories: -50, protein: 40, carbs: 100, fat: 30 }),
    );
    expect(result2).toBeNull();
  });

  it("returns null when remaining macros are not finite", () => {
    const result = pickNorthStarSuggestion(
      [mkRecipe()],
      rem({ calories: NaN, protein: 0, carbs: 0, fat: 0 }),
    );
    expect(result).toBeNull();
  });

  it("returns the closest-fit recipe with band 'tight' when within 5%", () => {
    const recipes = [
      mkRecipe({ id: "a", calories: 500, protein: 30, carbs: 50, fat: 18 }),
      mkRecipe({ id: "b", calories: 800, protein: 50, carbs: 80, fat: 30 }),
      mkRecipe({ id: "c", calories: 200, protein: 10, carbs: 25, fat: 6 }),
    ];
    // No slot → per-meal target = remaining (510), so band is the
    // per-serving fit to 510. Recipe a (500) is within 5%.
    const result = pickNorthStarSuggestion(recipes, rem({
      calories: 510,
      protein: 30,
      carbs: 55,
      fat: 18,
    }));
    expect(result).not.toBeNull();
    expect(result!.recipe.id).toBe("a");
    expect(result!.band).toBe("tight");
  });

  it("penalises over-shooting harder than under-shooting (asymmetric)", () => {
    // Two recipes: one over by 50 kcal, one under by 50 kcal. Under should win.
    const recipes = [
      mkRecipe({ id: "over", calories: 550, protein: 30, carbs: 50, fat: 18 }),
      mkRecipe({ id: "under", calories: 450, protein: 30, carbs: 50, fat: 18 }),
    ];
    const result = pickNorthStarSuggestion(recipes, rem({
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 18,
    }));
    expect(result!.recipe.id).toBe("under");
  });

  it("excludes recipes in `excludeIds` (used by swipe-to-skip)", () => {
    const recipes = [
      mkRecipe({ id: "a", calories: 500 }),
      mkRecipe({ id: "b", calories: 600 }),
    ];
    const result = pickNorthStarSuggestion(
      recipes,
      rem({ calories: 500, protein: 30, carbs: 50, fat: 18 }),
      { excludeIds: new Set(["a"]) },
    );
    expect(result!.recipe.id).toBe("b");
  });

  it("filters by slot when slot is provided", () => {
    const recipes = [
      mkRecipe({ id: "breakfast", calories: 500, mealType: "breakfast" }),
      mkRecipe({ id: "dinner", calories: 500, mealType: "dinner" }),
    ];
    const result = pickNorthStarSuggestion(
      recipes,
      rem({ calories: 500, protein: 30, carbs: 50, fat: 18, dailyCalorieTarget: 2000 }),
      { slot: "breakfast" },
    );
    expect(result!.recipe.id).toBe("breakfast");
  });

  it("untagged recipes are eligible for any slot", () => {
    const recipes = [mkRecipe({ id: "untagged", calories: 500, mealType: null })];
    const result = pickNorthStarSuggestion(
      recipes,
      rem({ calories: 500, protein: 30, carbs: 50, fat: 18, dailyCalorieTarget: 2000 }),
      { slot: "lunch" },
    );
    expect(result).not.toBeNull();
    expect(result!.recipe.id).toBe("untagged");
  });

  it("treats array mealType as multi-slot eligibility", () => {
    const recipes = [
      mkRecipe({ id: "multi", calories: 500, mealType: ["lunch", "dinner"] }),
    ];
    const lunch = pickNorthStarSuggestion(
      recipes,
      rem({ calories: 500, protein: 30, carbs: 50, fat: 18, dailyCalorieTarget: 2000 }),
      { slot: "lunch" },
    );
    expect(lunch?.recipe.id).toBe("multi");

    const breakfast = pickNorthStarSuggestion(
      recipes,
      rem({ calories: 500, protein: 30, carbs: 50, fat: 18, dailyCalorieTarget: 2000 }),
      { slot: "breakfast" },
    );
    expect(breakfast).toBeNull();
  });

  it("rejects recipes with non-positive base calories (defensive)", () => {
    const recipes = [mkRecipe({ id: "bad", calories: 0 })];
    const result = pickNorthStarSuggestion(
      recipes,
      rem({ calories: 500, protein: 30, carbs: 50, fat: 18 }),
    );
    expect(result).toBeNull();
  });
});

/* ───────────────── ENG-995 — actual servings + per-meal budget ──────── */

describe("ENG-995: actual servings only (no portion scaling)", () => {
  it("(a) shows the recipe's REAL per-serving calories — a 573-kcal recipe reads 573, not a scaled 860", () => {
    // The founder bug: a 573-kcal/serving recipe displayed as 860 kcal
    // (1.5× scaling). The card must now show exactly what the recipe
    // detail shows — one serving.
    const recipe = mkRecipe({
      id: "steak-bowl",
      calories: 573,
      protein: 42,
      carbs: 35,
      fat: 28,
    });
    const result = pickNorthStarSuggestion(
      [recipe],
      // Plenty of room left, full day ahead — the old scorer would
      // have scaled UP toward the remaining envelope.
      rem({ calories: 1800, protein: 130, carbs: 200, fat: 60, dailyCalorieTarget: 2000 }),
      { slot: "dinner" },
    );
    expect(result).not.toBeNull();
    // Predicted == recipe per-serving, identical to recipe detail.
    expect(result!.predictedCalories).toBe(573);
    expect(result!.predictedProtein).toBe(42);
    expect(result!.predictedCarbs).toBe(35);
    expect(result!.predictedFat).toBe(28);
    // And it is exactly one serving.
    expect(result!.portionMultiplier).toBe(1);
  });

  it("(c) never produces a portion greater than one serving, even with a huge remaining envelope", () => {
    // Spread a range of recipe sizes; whichever wins, it must be a
    // single serving. Pre-ENG-995 this could return a 2× portion.
    const recipes = [
      mkRecipe({ id: "small", calories: 220, protein: 12, carbs: 24, fat: 7 }),
      mkRecipe({ id: "mid", calories: 540, protein: 35, carbs: 48, fat: 20 }),
      mkRecipe({ id: "large", calories: 760, protein: 50, carbs: 70, fat: 30 }),
    ];
    const result = pickNorthStarSuggestion(
      recipes,
      // 2,400 kcal left at the start of the day — the whole-day scorer
      // would have reached for a double portion to "fill" it.
      rem({ calories: 2400, protein: 180, carbs: 260, fat: 80, dailyCalorieTarget: 2400 }),
      { slot: "lunch" },
    );
    expect(result).not.toBeNull();
    expect(result!.portionMultiplier).toBe(1);
    // Predicted calories equal the chosen recipe's single serving.
    expect(result!.predictedCalories).toBe(result!.recipe.calories);
  });

  it("(b) in the morning with a full day left, picks a meal-sized recipe, not the recipe nearest the whole day", () => {
    // The decisive behaviour fix. Day target 2,400; nothing logged, so
    // the whole 2,400 is remaining. A normal lunch should be ~35% of
    // that (~840 kcal), NOT a 1,900-kcal mega-meal sized to the day.
    const normalMeal = mkRecipe({ id: "salad-bowl", calories: 620, protein: 38, carbs: 55, fat: 22 });
    const megaMeal = mkRecipe({ id: "mega-roast", calories: 1900, protein: 90, carbs: 150, fat: 95 });
    const result = pickNorthStarSuggestion(
      [normalMeal, megaMeal],
      rem({ calories: 2400, protein: 180, carbs: 260, fat: 80, dailyCalorieTarget: 2400 }),
      { slot: "lunch" },
    );
    expect(result).not.toBeNull();
    // The normal meal must win — it sits near the per-meal budget
    // (0.35 · 2400 = 840), whereas the mega-meal blows ~2.3× past it.
    expect(result!.recipe.id).toBe("salad-bowl");
  });

  it("(b) per-meal budget tracks slotShare · dayTarget when the day is wide open", () => {
    // White-box check on the band: with a single recipe sitting exactly
    // on the lunch budget (0.35 · 2000 = 700), the band must read tight
    // even though remaining (2000) is far larger than the recipe.
    const onBudget = mkRecipe({ id: "on", calories: 700, protein: 45, carbs: 60, fat: 24 });
    const result = pickNorthStarSuggestion(
      [onBudget],
      rem({ calories: 2000, protein: 150, carbs: 220, fat: 70, dailyCalorieTarget: 2000 }),
      { slot: "lunch" },
    );
    expect(result).not.toBeNull();
    expect(result!.recipe.id).toBe("on");
    // Lands on the per-meal target → tight, NOT measured against 2000.
    expect(result!.band).toBe("tight");
    // calorieDelta is distance from the per-meal target (700), so ~0 —
    // proving the score is vs the meal budget, not the 2000 remaining.
    expect(Math.abs(result!.calorieDelta)).toBeLessThanOrEqual(35);
  });

  it("(b) late in the day with little left, the per-meal budget caps at remaining", () => {
    // Only 300 kcal left. Even a normally lunch-sized recipe is too big;
    // the small one wins because the budget is capped at remaining (300),
    // not slotShare · dayTarget (which would be 700).
    const small = mkRecipe({ id: "small", calories: 290, protein: 22, carbs: 24, fat: 9 });
    const lunchSized = mkRecipe({ id: "lunchy", calories: 680, protein: 42, carbs: 58, fat: 22 });
    const result = pickNorthStarSuggestion(
      [small, lunchSized],
      rem({ calories: 300, protein: 30, carbs: 30, fat: 10, dailyCalorieTarget: 2000 }),
      { slot: "lunch" },
    );
    expect(result).not.toBeNull();
    expect(result!.recipe.id).toBe("small");
    // Within 5% of the capped 300 budget → tight.
    expect(result!.band).toBe("tight");
  });
});

describe("slot-share constants (ENG-995 — tunable)", () => {
  it("default slot shares match the documented split", () => {
    expect(NORTH_STAR_SLOT_SHARE.breakfast).toBe(0.25);
    expect(NORTH_STAR_SLOT_SHARE.lunch).toBe(0.35);
    expect(NORTH_STAR_SLOT_SHARE.dinner).toBe(0.35);
    expect(NORTH_STAR_SLOT_SHARE.snack).toBe(0.1);
  });

  it("no-slot share is the whole remaining day", () => {
    expect(NORTH_STAR_NO_SLOT_SHARE).toBe(1.0);
  });
});

describe("pickNextNorthStarSuggestion (skip flow)", () => {
  it("returns the next-best recipe after one is excluded", () => {
    const recipes = [
      mkRecipe({ id: "first", calories: 500 }),
      mkRecipe({ id: "second", calories: 480 }),
      mkRecipe({ id: "third", calories: 800 }),
    ];
    const next = pickNextNorthStarSuggestion(
      recipes,
      rem({ calories: 500, protein: 30, carbs: 50, fat: 18 }),
      new Set(["first"]),
    );
    expect(next!.recipe.id).toBe("second");
  });
});

describe("detectSlotForHour", () => {
  it("returns 'breakfast' for 06:00–10:30", () => {
    expect(detectSlotForHour(6 * 60)).toBe("breakfast");
    expect(detectSlotForHour(8 * 60 + 30)).toBe("breakfast");
    expect(detectSlotForHour(10 * 60 + 29)).toBe("breakfast");
  });

  it("returns 'lunch' for 10:30–14:30", () => {
    expect(detectSlotForHour(10 * 60 + 30)).toBe("lunch");
    expect(detectSlotForHour(12 * 60)).toBe("lunch");
    expect(detectSlotForHour(14 * 60 + 29)).toBe("lunch");
  });

  it("returns 'snack' for 14:30–17:30", () => {
    expect(detectSlotForHour(14 * 60 + 30)).toBe("snack");
    expect(detectSlotForHour(16 * 60)).toBe("snack");
    expect(detectSlotForHour(17 * 60 + 29)).toBe("snack");
  });

  it("returns 'dinner' for 17:30–22:00", () => {
    expect(detectSlotForHour(17 * 60 + 30)).toBe("dinner");
    expect(detectSlotForHour(19 * 60)).toBe("dinner");
    expect(detectSlotForHour(21 * 60 + 59)).toBe("dinner");
  });

  it("returns null outside the spec window (late night / pre-dawn)", () => {
    expect(detectSlotForHour(2 * 60)).toBeNull();
    expect(detectSlotForHour(22 * 60 + 30)).toBeNull();
    expect(detectSlotForHour(5 * 60 + 59)).toBeNull();
  });

  it("returns null on non-finite input", () => {
    expect(detectSlotForHour(NaN)).toBeNull();
    expect(detectSlotForHour(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("ctaForSlot — spec copy", () => {
  it("'Log breakfast' for breakfast", () => {
    expect(ctaForSlot("breakfast")).toBe("Log breakfast");
  });
  it("'Log lunch' for lunch", () => {
    expect(ctaForSlot("lunch")).toBe("Log lunch");
  });
  it("'Cook ahead →' for snack", () => {
    expect(ctaForSlot("snack")).toBe("Cook ahead →");
  });
  it("'Cook it →' for dinner", () => {
    expect(ctaForSlot("dinner")).toBe("Cook it →");
  });
  it("'Log it' fallback for null", () => {
    expect(ctaForSlot(null)).toBe("Log it");
  });
});

describe("bandLabel — spec copy", () => {
  it("'Hits within 3%' for tight", () => {
    expect(bandLabel("tight")).toBe("Hits within 3%");
  });
  it("'Close fit' for close", () => {
    expect(bandLabel("close")).toBe("Close fit");
  });
  it("'Roughly fits' for loose", () => {
    expect(bandLabel("loose")).toBe("Roughly fits");
  });
});

describe("library threshold (V-6 sub-decision)", () => {
  it("NORTH_STAR_LIBRARY_MIN is 5 (default per V-6)", () => {
    expect(NORTH_STAR_LIBRARY_MIN).toBe(5);
  });

  it("isLibraryEligibleForNorthStar gates at 5 for steady-state users (account ≥ 30 days)", () => {
    // Pre-2026-04-30 the gate had no activation window — single-arg
    // calls always used the steady-state ≥5 threshold. The leak fix
    // #5 round-2 introduced a 30-day activation relax to ≥2; to
    // continue testing the legacy gate at 5 we must explicitly pass
    // an "old enough" creation date. See the
    // "activation-window threshold" describe block below for the
    // single-arg semantics (which now defaults to the relaxed path).
    const old = new Date("2026-01-01T00:00:00.000Z");
    const NOW_LEGACY = new Date("2026-04-30T00:00:00.000Z");
    expect(isLibraryEligibleForNorthStar(0, old, NOW_LEGACY)).toBe(false);
    expect(isLibraryEligibleForNorthStar(4, old, NOW_LEGACY)).toBe(false);
    expect(isLibraryEligibleForNorthStar(5, old, NOW_LEGACY)).toBe(true);
    expect(isLibraryEligibleForNorthStar(50, old, NOW_LEGACY)).toBe(true);
    expect(isLibraryEligibleForNorthStar(NaN, old, NOW_LEGACY)).toBe(false);
  });
});

describe("activation-window threshold (audit 2026-04-30 leak fix #5)", () => {
  // Reference "now" — used as the second argument so tests are
  // deterministic regardless of when CI runs.
  const NOW = new Date("2026-04-30T12:00:00.000Z");

  it("relaxed threshold + window constants are 2 / 30 days", () => {
    expect(NORTH_STAR_LIBRARY_MIN_ACTIVATION).toBe(2);
    expect(NORTH_STAR_ACTIVATION_WINDOW_DAYS).toBe(30);
  });

  describe("isWithinNorthStarActivationWindow", () => {
    it("returns true for null/undefined (new-user safety net)", () => {
      expect(isWithinNorthStarActivationWindow(null, NOW)).toBe(true);
      expect(isWithinNorthStarActivationWindow(undefined, NOW)).toBe(true);
    });

    it("returns true for unparseable input (safety net)", () => {
      expect(isWithinNorthStarActivationWindow("not-a-date", NOW)).toBe(true);
    });

    it("returns true when account is < 30 days old", () => {
      const created = new Date("2026-04-20T12:00:00.000Z"); // 10 days
      expect(isWithinNorthStarActivationWindow(created, NOW)).toBe(true);
      // Same as ISO string.
      expect(isWithinNorthStarActivationWindow(created.toISOString(), NOW)).toBe(true);
    });

    it("returns true at exactly 29 days, false at exactly 31 days", () => {
      const day29 = new Date("2026-04-01T12:00:00.000Z"); // 29 days
      const day31 = new Date("2026-03-30T12:00:00.000Z"); // 31 days
      expect(isWithinNorthStarActivationWindow(day29, NOW)).toBe(true);
      expect(isWithinNorthStarActivationWindow(day31, NOW)).toBe(false);
    });

    it("returns false when account is older than 30 days", () => {
      const created = new Date("2026-01-01T12:00:00.000Z"); // ~120 days
      expect(isWithinNorthStarActivationWindow(created, NOW)).toBe(false);
      expect(isWithinNorthStarActivationWindow(created.toISOString(), NOW)).toBe(false);
    });

    it("returns true when creation date is in the future (clock drift safety)", () => {
      const future = new Date("2026-05-15T00:00:00.000Z");
      expect(isWithinNorthStarActivationWindow(future, NOW)).toBe(true);
    });
  });

  describe("isLibraryEligibleForNorthStar with userCreatedAt", () => {
    it("threshold is 2 for accounts < 30 days old", () => {
      const created = new Date("2026-04-20T12:00:00.000Z"); // 10 days
      expect(isLibraryEligibleForNorthStar(0, created, NOW)).toBe(false);
      expect(isLibraryEligibleForNorthStar(1, created, NOW)).toBe(false);
      expect(isLibraryEligibleForNorthStar(2, created, NOW)).toBe(true);
      expect(isLibraryEligibleForNorthStar(3, created, NOW)).toBe(true);
      expect(isLibraryEligibleForNorthStar(5, created, NOW)).toBe(true);
    });

    it("threshold is 5 for accounts >= 30 days old", () => {
      const created = new Date("2026-01-01T12:00:00.000Z"); // ~120 days
      expect(isLibraryEligibleForNorthStar(2, created, NOW)).toBe(false);
      expect(isLibraryEligibleForNorthStar(3, created, NOW)).toBe(false);
      expect(isLibraryEligibleForNorthStar(4, created, NOW)).toBe(false);
      expect(isLibraryEligibleForNorthStar(5, created, NOW)).toBe(true);
      expect(isLibraryEligibleForNorthStar(50, created, NOW)).toBe(true);
    });

    it("threshold is 2 when userCreatedAt is null (safety net for new users)", () => {
      expect(isLibraryEligibleForNorthStar(2, null, NOW)).toBe(true);
      expect(isLibraryEligibleForNorthStar(2, undefined, NOW)).toBe(true);
      expect(isLibraryEligibleForNorthStar(1, null, NOW)).toBe(false);
    });

    it("rejects non-finite library size regardless of account age", () => {
      const young = new Date("2026-04-25T12:00:00.000Z");
      const old = new Date("2025-01-01T12:00:00.000Z");
      expect(isLibraryEligibleForNorthStar(NaN, young, NOW)).toBe(false);
      expect(isLibraryEligibleForNorthStar(NaN, old, NOW)).toBe(false);
      expect(isLibraryEligibleForNorthStar(Infinity, young, NOW)).toBe(false);
    });

    it("single-arg call defaults to the relaxed (activation-window) threshold", () => {
      // Behaviour change (audit 2026-04-30): single-arg calls now
      // default to the relaxed path because "we don't know how old
      // this user is" is the same risk shape as "this is a new user".
      // The safety net is intentional — better to surface a real
      // suggestion to a 90-day-old user once than gate it off from
      // a 5-day-old user. Callers that need the strict ≥5 path must
      // pass an old-enough creation date explicitly.
      expect(isLibraryEligibleForNorthStar(2)).toBe(true);
      expect(isLibraryEligibleForNorthStar(1)).toBe(false);
      expect(isLibraryEligibleForNorthStar(5)).toBe(true);
      expect(isLibraryEligibleForNorthStar(0)).toBe(false);
    });
  });
});

describe("whyLineForSuggestion (activation hook — leak fix #5)", () => {
  it("returns the protein+calorie why-line when both fit", () => {
    // Picking a recipe at 480 kcal vs 500 remaining → per-meal target
    // 500 (no slot), cal delta 20 (4% — band tight, calorieFits=true).
    // Protein 32g vs remaining 35g → 91% filled (proteinFits=true).
    const recipes: NorthStarRecipe[] = [
      {
        id: "a",
        title: "Match",
        calories: 480,
        protein: 32,
        carbs: 50,
        fat: 18,
      },
    ];
    const remaining = rem({ calories: 500, protein: 35, carbs: 60, fat: 20 });
    const suggestion = pickNorthStarSuggestion(recipes, remaining);
    expect(suggestion).not.toBeNull();
    const line = whyLineForSuggestion(suggestion!, remaining);
    expect(line).toBe("Hits both your protein + calorie target");
  });

  it("returns the protein-only why-line when calorie fit is loose", () => {
    // 600 cal vs 500 remaining → per-meal target 500 (no slot), cal
    // delta 100 (20% — band loose, calorieFits=false).
    // 35g protein vs 35g remaining → 100% filled (proteinFits=true).
    const remaining = rem({ calories: 500, protein: 35, carbs: 60, fat: 20 });
    const suggestion = pickNorthStarSuggestion(
      [
        {
          id: "a",
          title: "Match",
          calories: 600,
          protein: 35,
          carbs: 60,
          fat: 22,
        },
      ],
      remaining,
    );
    expect(suggestion).not.toBeNull();
    const line = whyLineForSuggestion(suggestion!, remaining);
    expect(line).toBe("Fits your remaining 35g protein");
  });

  it("falls back to the calorie why-line when protein fit is weak", () => {
    // 500 cal vs 500 remaining → per-meal target 500, cal delta 0 (band
    // tight, calorieFits=true).
    // 5g protein vs 35g remaining → 14% filled (proteinFits=false because
    // remaining.protein >= 10 but filledProteinFraction < 0.8).
    const remaining = rem({ calories: 500, protein: 35, carbs: 60, fat: 20 });
    const suggestion = pickNorthStarSuggestion(
      [
        {
          id: "a",
          title: "Match",
          calories: 500,
          protein: 5,
          carbs: 50,
          fat: 18,
        },
      ],
      remaining,
    );
    expect(suggestion).not.toBeNull();
    const line = whyLineForSuggestion(suggestion!, remaining);
    expect(line).toBe("Fits your remaining 500 kcal");
  });

  it("formats thousands in the calorie why-line via the shared formatter (ENG-1305)", () => {
    // "Fits your remaining 1900 kcal" read as a typo next to every other
    // kcal surface (LogSheet, weekly check-in) which renders "1,900".
    const remaining = rem({ calories: 1900, protein: 5, carbs: 200, fat: 60 });
    const suggestion = pickNorthStarSuggestion(
      [
        {
          id: "a",
          title: "Big day",
          calories: 1900,
          protein: 5,
          carbs: 190,
          fat: 55,
        },
      ],
      remaining,
    );
    expect(suggestion).not.toBeNull();
    const line = whyLineForSuggestion(suggestion!, remaining);
    expect(line).toBe("Fits your remaining 1,900 kcal");
  });

  it("uses calorie why-line when remaining protein is < 10g (already mostly hit)", () => {
    // The protein-fits gate requires remaining.protein >= 10 — so a user
    // with only 5g of protein left should never see the protein why-line
    // even if the suggestion's protein delivery is close to that gap.
    const remaining = rem({ calories: 500, protein: 5, carbs: 60, fat: 20 });
    const suggestion = pickNorthStarSuggestion(
      [
        {
          id: "a",
          title: "Match",
          calories: 500,
          protein: 5,
          carbs: 50,
          fat: 18,
        },
      ],
      remaining,
    );
    expect(suggestion).not.toBeNull();
    const line = whyLineForSuggestion(suggestion!, remaining);
    expect(line).toBe("Fits your remaining 500 kcal");
  });

  it("formats remaining calories ≥ 1000 with a thousands separator (ENG-1294)", () => {
    // Matches the Today ring format ("1,900" not "1900") — same
    // `toLocaleString` the ring + coach rows already use.
    const remaining = rem({ calories: 1900, protein: 5, carbs: 200, fat: 60 });
    const suggestion = pickNorthStarSuggestion(
      [
        {
          id: "a",
          title: "Match",
          calories: 1900,
          protein: 5,
          carbs: 200,
          fat: 60,
        },
      ],
      remaining,
    );
    expect(suggestion).not.toBeNull();
    const line = whyLineForSuggestion(suggestion!, remaining);
    expect(line).toBe(`Fits your remaining ${(1900).toLocaleString()} kcal`);
    expect(line).not.toContain("1900");
  });

  it("returns a generic line when remaining calories are non-positive (defensive)", () => {
    // Caller should have already short-circuited via
    // pickNorthStarSuggestion returning null in this case — this asserts
    // we don't crash if it does sneak through.
    const fakeSuggestion = {
      recipe: {
        id: "x",
        title: "X",
        calories: 500,
        protein: 30,
        carbs: 50,
        fat: 18,
      },
      portionMultiplier: 1,
      predictedCalories: 500,
      predictedProtein: 30,
      predictedCarbs: 50,
      predictedFat: 18,
      calorieDelta: 0,
      band: "tight" as const,
      score: 0,
    };
    const line = whyLineForSuggestion(fakeSuggestion, rem({
      calories: 0,
      protein: 30,
      carbs: 50,
      fat: 18,
    }));
    expect(line).toBe("Fits your remaining macros");
  });

  it("never returns an empty string", () => {
    // Brittleness check — every branch must return a non-empty,
    // user-readable string.
    const remaining = rem({ calories: 1000, protein: 50, carbs: 120, fat: 30 });
    const suggestion = pickNorthStarSuggestion(
      [
        {
          id: "a",
          title: "Match",
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 4,
        },
      ],
      remaining,
    );
    expect(suggestion).not.toBeNull();
    const line = whyLineForSuggestion(suggestion!, remaining);
    expect(line.length).toBeGreaterThan(0);
  });
});
