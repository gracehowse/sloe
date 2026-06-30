/**
 * Make-anything-fit · Mode B — distribute-around-anchor (ENG-855).
 *
 * Pins the distribution math + the nutrition-trust + body-neutral-copy
 * contracts for the Plan-tab half of the engine (spec:
 * docs/specs/2026-06-02-make-anything-fit-engine.md):
 *
 *   • per-slot calorie + macro distribution by dietitian weight,
 *   • per-slot FLOORS (never propose a 120 kcal "meal"),
 *   • the honest "anchor leaves too little" case,
 *   • macros-not-just-calories (a high-fat anchor leans the rest),
 *   • the NO-NEGATIVE invariant (over-budget anchor never hands a negative
 *     or inflated budget),
 *   • the NUTRITION-TRUST gate (low-confidence anchor → qualitative, never a
 *     fabricated per-slot number),
 *   • body-neutral, enabling-not-restricting copy.
 */

import { describe, expect, it } from "vitest";
import {
  distributeAroundAnchor,
  distributeAroundAnchorCopy,
  planDayDistributeAroundAnchor,
  MODE_B_SLOT_FLOOR_KCAL,
  type AnchorMeal,
  type DistributeAroundAnchorResult,
  type PlanDayMealLike,
} from "../../src/lib/nutrition/distributeAroundAnchor";
import type { MacroTargets, MacroConsumed } from "../../src/lib/nutrition/remainingMacros";

const DAY: MacroTargets = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
const NOTHING: MacroConsumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
const FOUR_SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

/** Narrow a result to the distributed variant for ergonomic assertions. */
function distributed(r: DistributeAroundAnchorResult) {
  if (r.kind !== "distributed") {
    throw new Error(`expected distributed, got ${r.kind}`);
  }
  return r;
}

/** Verified 800 kcal dinner anchor (Grace's worked example). */
const SPAG_BOL: AnchorMeal = {
  slot: "Dinner",
  calories: 800,
  protein: 50,
  carbs: 90,
  fat: 25,
  confidence: "verified",
};

describe("distributeAroundAnchor — worked example (800 kcal dinner)", () => {
  it("spreads the ~1200 kcal remainder across the OTHER open slots, excluding the anchor slot", () => {
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, SPAG_BOL, FOUR_SLOTS),
    );
    const bySlot = Object.fromEntries(res.slots.map((s) => [s.slot, s]));

    // Dinner is the anchor — it is NOT one of the distributed open slots.
    expect(res.slots.map((s) => s.slot)).toEqual(["Breakfast", "Lunch", "Snacks"]);
    expect(res.remainingCalories).toBe(1200); // 2000 − 800

    // Weights over the open slots (Breakfast .25 / Lunch .3 / Snacks .1) sum
    // to 0.65; shares = 0.25/0.65, 0.3/0.65, 0.1/0.65 of 1200 kcal.
    expect(bySlot.Breakfast.calories).toBe(Math.round(1200 * (0.25 / 0.65))); // 462
    expect(bySlot.Lunch.calories).toBe(Math.round(1200 * (0.3 / 0.65))); // 554
    expect(bySlot.Snacks.calories).toBe(Math.round(1200 * (0.1 / 0.65))); // 185

    // The distributed calories never exceed the remainder beyond per-slot
    // integer-rounding noise (each of N slots rounds to nearest → at most N
    // kcal of drift; the underlying shares sum to exactly the remainder).
    const sum = res.slots.reduce((a, s) => a + s.calories, 0);
    expect(sum).toBeLessThanOrEqual(res.remainingCalories + res.slots.length);
    expect(res.anchorLeavesTooLittle).toBe(false);
  });

  it("distributes protein / carbs / fat by the same weights (macros, not just calories)", () => {
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, SPAG_BOL, FOUR_SLOTS),
    );
    const lunch = res.slots.find((s) => s.slot === "Lunch")!;
    const share = 0.3 / 0.65;
    expect(lunch.protein).toBe(Math.round((150 - 50) * share)); // remaining 100g P
    expect(lunch.carbs).toBe(Math.round((200 - 90) * share)); // remaining 110g C
    expect(lunch.fat).toBe(Math.round((67 - 25) * share)); // remaining 42g F
  });
});

describe("distributeAroundAnchor — a high-fat anchor leans the rest leaner on fat", () => {
  it("leaves a smaller fat remainder so the open slots come out lower-fat, not just smaller", () => {
    const leanAnchor: AnchorMeal = {
      slot: "Dinner",
      calories: 800,
      protein: 40,
      carbs: 40,
      fat: 55, // most of the day's 67g fat is in the anchor
      confidence: "verified",
    };
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, leanAnchor, FOUR_SLOTS),
    );
    const lunch = res.slots.find((s) => s.slot === "Lunch")!;
    const share = 0.3 / 0.65;
    // Only 12g fat left for the whole rest of the day → lunch's fat budget is tiny.
    expect(lunch.fat).toBe(Math.round((67 - 55) * share)); // ~6g
    // …while its calorie budget is still substantial (the lean-not-just-small point).
    expect(lunch.calories).toBeGreaterThan(400);
  });
});

describe("distributeAroundAnchor — per-slot FLOORS (failure-mode #3)", () => {
  it("flags a slot below the floor as tooTight rather than proposing an implausible meal", () => {
    // A 1700 kcal anchor on a 2000 kcal day leaves only 300 kcal for the rest.
    const bigAnchor: AnchorMeal = { ...SPAG_BOL, calories: 1700 };
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, bigAnchor, FOUR_SLOTS),
    );
    const breakfast = res.slots.find((s) => s.slot === "Breakfast")!;
    // 300 × 0.25/0.65 ≈ 115 kcal — below the 150 floor → flagged, not hidden.
    expect(breakfast.calories).toBeLessThan(MODE_B_SLOT_FLOOR_KCAL);
    expect(breakfast.tooTight).toBe(true);
  });

  it("sets anchorLeavesTooLittle when EVERY non-optional slot is below the floor", () => {
    // 1850 kcal anchor → 150 kcal across breakfast+lunch+snacks; both meal
    // slots fall well below the floor.
    const hugeAnchor: AnchorMeal = { ...SPAG_BOL, calories: 1850 };
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, hugeAnchor, FOUR_SLOTS),
    );
    expect(res.anchorLeavesTooLittle).toBe(true);
  });

  it("does NOT flag the optional Snacks slot as tooTight even when its share is small", () => {
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, SPAG_BOL, FOUR_SLOTS),
    );
    const snacks = res.slots.find((s) => s.slot === "Snacks")!;
    expect(snacks.optional).toBe(true);
    // 185 kcal is above the floor here, but the key contract is: optional slots
    // are never "too tight" — a small snack is just a snack.
    expect(snacks.tooTight).toBe(false);
  });
});

describe("distributeAroundAnchor — NO-NEGATIVE invariant", () => {
  it("never hands a slot a negative budget when the anchor exceeds the day target", () => {
    const overAnchor: AnchorMeal = {
      slot: "Dinner",
      calories: 2500, // bigger than the whole 2000 kcal day
      protein: 200,
      carbs: 300,
      fat: 100,
      confidence: "verified",
    };
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, overAnchor, FOUR_SLOTS),
    );
    expect(res.remainingCalories).toBe(0);
    for (const s of res.slots) {
      expect(s.calories).toBe(0);
      expect(s.protein).toBe(0);
      expect(s.carbs).toBe(0);
      expect(s.fat).toBe(0);
      expect(s.calories).toBeGreaterThanOrEqual(0);
    }
    expect(res.anchorLeavesTooLittle).toBe(true);
  });

  it("clamps already-consumed totals so an over-logged day can't inflate budgets", () => {
    const consumed: MacroConsumed = { calories: 1500, protein: 100, carbs: 150, fat: 50 };
    const res = distributed(
      distributeAroundAnchor(DAY, consumed, SPAG_BOL, FOUR_SLOTS),
    );
    // 2000 − 1500 consumed − 800 anchor = −300 → floored at 0.
    expect(res.remainingCalories).toBe(0);
    for (const s of res.slots) expect(s.calories).toBe(0);
  });

  it("treats NaN / negative inputs as 0 rather than producing garbage budgets", () => {
    const res = distributed(
      distributeAroundAnchor(
        { calories: 2000, protein: 150, carbs: 200, fat: 67 },
        { calories: Number.NaN, protein: -50, carbs: 0, fat: 0 },
        { slot: "Dinner", calories: 800, protein: Number.NaN, carbs: 90, fat: 25, confidence: "verified" },
        FOUR_SLOTS,
      ),
    );
    for (const s of res.slots) {
      expect(Number.isFinite(s.calories)).toBe(true);
      expect(s.calories).toBeGreaterThanOrEqual(0);
      expect(s.protein).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("distributeAroundAnchor — NUTRITION-TRUST gate", () => {
  it("returns qualitative (no per-slot numbers) for a low-confidence anchor", () => {
    const estimated: AnchorMeal = { ...SPAG_BOL, confidence: "estimated" };
    const res = distributeAroundAnchor(DAY, NOTHING, estimated, FOUR_SLOTS);
    expect(res.kind).toBe("qualitative");
    if (res.kind === "qualitative") expect(res.reason).toBe("low-confidence");
  });

  it("also degrades on the coarse 'low' tier", () => {
    const low: AnchorMeal = { ...SPAG_BOL, confidence: "low" };
    expect(distributeAroundAnchor(DAY, NOTHING, low, FOUR_SLOTS).kind).toBe("qualitative");
  });

  it("quantifies only when the anchor is verified / high confidence", () => {
    expect(distributeAroundAnchor(DAY, NOTHING, { ...SPAG_BOL, confidence: "verified" }, FOUR_SLOTS).kind).toBe(
      "distributed",
    );
    expect(distributeAroundAnchor(DAY, NOTHING, { ...SPAG_BOL, confidence: "high" }, FOUR_SLOTS).kind).toBe(
      "distributed",
    );
  });
});

describe("distributeAroundAnchor — slot handling edges", () => {
  it("excludes the anchor slot and de-dupes duplicate open slots", () => {
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, SPAG_BOL, [
        "Dinner",
        "Breakfast",
        "Breakfast",
        "Lunch",
      ]),
    );
    expect(res.slots.map((s) => s.slot)).toEqual(["Breakfast", "Lunch"]);
  });

  it("is case-insensitive on the anchor-slot exclusion", () => {
    const res = distributed(
      distributeAroundAnchor(
        DAY,
        NOTHING,
        { ...SPAG_BOL, slot: "dinner" },
        FOUR_SLOTS,
      ),
    );
    expect(res.slots.map((s) => s.slot)).not.toContain("Dinner");
  });

  it("omits fibre budgets entirely when the user has no fibre target", () => {
    const res = distributed(
      distributeAroundAnchor(DAY, NOTHING, SPAG_BOL, FOUR_SLOTS),
    );
    for (const s of res.slots) expect(s.fiber).toBeUndefined();
  });

  it("distributes fibre when a fibre target is set", () => {
    const withFiber: MacroTargets = { ...DAY, fiber: 30 };
    const anchorFiber: AnchorMeal = { ...SPAG_BOL, fiber: 8 };
    const res = distributed(
      distributeAroundAnchor(withFiber, NOTHING, anchorFiber, FOUR_SLOTS),
    );
    const lunch = res.slots.find((s) => s.slot === "Lunch")!;
    expect(lunch.fiber).toBe(Math.round((30 - 8) * (0.3 / 0.65)));
  });

  it("handles numbered (non-named) slots with an even share fallback", () => {
    const res = distributed(
      distributeAroundAnchor(
        DAY,
        NOTHING,
        { slot: "Meal 1", calories: 500, protein: 30, carbs: 60, fat: 15, confidence: "verified" },
        ["Meal 1", "Meal 2", "Meal 3"],
      ),
    );
    // Two open numbered slots → even split of the 1500 kcal remainder.
    const cals = res.slots.map((s) => s.calories);
    expect(res.slots.map((s) => s.slot)).toEqual(["Meal 2", "Meal 3"]);
    expect(cals[0]).toBe(cals[1]);
    expect(cals[0]).toBe(Math.round(1500 / 2));
  });
});

describe("distributeAroundAnchorCopy — body-neutral, enabling framing", () => {
  it("names the open meal slots in the enabling 'shake out' frame", () => {
    const res = distributeAroundAnchor(DAY, NOTHING, SPAG_BOL, FOUR_SLOTS);
    const copy = distributeAroundAnchorCopy(res, "Spag bol", "Dinner");
    expect(copy).toBe(
      "Spag bol's in for dinner — here's how breakfast and lunch shake out.",
    );
    // Snacks (optional) is never named as an aim.
    expect(copy).not.toContain("snacks");
    // Never a deficit instruction.
    expect(copy).not.toMatch(/eat less|cut back|deficit|burn off/i);
  });

  it("is honest (not a fabricated tiny number) when the anchor leaves too little", () => {
    const huge: AnchorMeal = { ...SPAG_BOL, calories: 1850 };
    const res = distributeAroundAnchor(DAY, NOTHING, huge, FOUR_SLOTS);
    const copy = distributeAroundAnchorCopy(res, "The cake", "Dinner");
    expect(copy).toBe(
      "The cake fills most of today — the other slots barely have room, but it's your call.",
    );
    expect(copy).not.toMatch(/eat less|skip/i);
  });

  it("stays qualitative for a low-confidence anchor — no per-slot numbers in the line", () => {
    const est: AnchorMeal = { ...SPAG_BOL, confidence: "estimated" };
    const res = distributeAroundAnchor(DAY, NOTHING, est, FOUR_SLOTS);
    const copy = distributeAroundAnchorCopy(res, "Grandma's stew", "Dinner");
    expect(copy).toBe(
      "Grandma's stew's in for dinner — here's roughly how the rest of the day shakes out.",
    );
    expect(copy).not.toMatch(/\d/); // no fabricated number
  });

  it("falls back to a safe label when the anchor name is blank", () => {
    const res = distributeAroundAnchor(DAY, NOTHING, SPAG_BOL, FOUR_SLOTS);
    const copy = distributeAroundAnchorCopy(res, "   ", "Dinner");
    expect(copy?.startsWith("That meal")).toBe(true);
  });

  it("returns null when there is no result", () => {
    expect(distributeAroundAnchorCopy(null, "x", "Dinner")).toBeNull();
  });
});

describe("planDayDistributeAroundAnchor — Plan-host selector", () => {
  const placeholder = (name: string): PlanDayMealLike => ({
    name,
    recipeTitle: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    isPlaceholder: true,
  });

  const lockedDinner: PlanDayMealLike = {
    name: "Dinner",
    recipeTitle: "Spag bol",
    calories: 800,
    protein: 50,
    carbs: 90,
    fat: 25,
    isLocked: true,
  };

  it("returns null when there is no locked anchor", () => {
    const meals = [placeholder("Breakfast"), placeholder("Lunch"), placeholder("Dinner")];
    expect(planDayDistributeAroundAnchor(meals, DAY)).toBeNull();
  });

  it("returns null when there are no open slots to distribute into", () => {
    const meals = [lockedDinner];
    expect(planDayDistributeAroundAnchor(meals, DAY)).toBeNull();
  });

  it("returns null when there is no calorie target", () => {
    const meals = [lockedDinner, placeholder("Breakfast")];
    expect(
      planDayDistributeAroundAnchor(meals, { calories: 0, protein: 0, carbs: 0, fat: 0 }),
    ).toBeNull();
  });

  it("derives the anchor + open slots and runs the engine", () => {
    const meals = [
      placeholder("Breakfast"),
      placeholder("Lunch"),
      lockedDinner,
      placeholder("Snacks"),
    ];
    const out = planDayDistributeAroundAnchor(meals, DAY)!;
    expect(out.anchorSlot).toBe("Dinner");
    expect(out.result.kind).toBe("distributed");
    if (out.result.kind === "distributed") {
      expect(out.result.slots.map((s) => s.slot)).toEqual(["Breakfast", "Lunch", "Snacks"]);
      expect(out.result.remainingCalories).toBe(1200);
    }
    expect(out.copy).toBe(
      "Spag bol's in for dinner — here's how breakfast and lunch shake out.",
    );
  });

  it("treats other PLACED meals as consumed budget", () => {
    const placedBreakfast: PlanDayMealLike = {
      name: "Breakfast",
      recipeTitle: "Oats",
      calories: 400,
      protein: 20,
      carbs: 60,
      fat: 8,
    };
    const meals = [placedBreakfast, placeholder("Lunch"), lockedDinner];
    const out = planDayDistributeAroundAnchor(meals, DAY)!;
    if (out.result.kind !== "distributed") throw new Error("expected distributed");
    // 2000 − 400 (oats) − 800 (anchor) = 800 kcal across the one open Lunch slot.
    expect(out.result.remainingCalories).toBe(800);
    const lunch = out.result.slots.find((s) => s.slot === "Lunch")!;
    expect(lunch.calories).toBe(800); // single open slot absorbs all the remainder
  });

  it("scales the anchor by its portionMultiplier", () => {
    const meals = [
      placeholder("Breakfast"),
      { ...lockedDinner, portionMultiplier: 2 }, // 1600 kcal anchor
    ];
    const out = planDayDistributeAroundAnchor(meals, DAY)!;
    if (out.result.kind !== "distributed") throw new Error("expected distributed");
    expect(out.result.remainingCalories).toBe(400); // 2000 − 1600
  });

  it("returns a qualitative result when the anchor macros are estimated", () => {
    const meals = [
      placeholder("Breakfast"),
      { ...lockedDinner, macrosAreEstimated: true },
    ];
    const out = planDayDistributeAroundAnchor(meals, DAY)!;
    expect(out.result.kind).toBe("qualitative");
    expect(out.copy).toBe(
      "Spag bol's in for dinner — here's roughly how the rest of the day shakes out.",
    );
    expect(out.copy).not.toMatch(/\d/);
  });
});
