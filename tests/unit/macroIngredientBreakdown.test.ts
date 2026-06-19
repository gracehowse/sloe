import { describe, expect, it } from "vitest";
import {
  deriveIngredientBreakdown,
  toBreakdownEntry,
  toBreakdownIngredientRow,
  toBreakdownSnapshotRow,
  type BreakdownEntry,
  type BreakdownIngredientRow,
  type BreakdownSnapshotRow,
} from "../../src/lib/nutrition/macroIngredientBreakdown";

/**
 * ENG-748 #10 — shared "By ingredient" derive/scale/reconcile helper.
 *
 * These tests protect the nutrition-correctness contract: displayed ingredient
 * macros ALWAYS sum to the entry's stored (logged) macro total, the degenerate
 * fallbacks never render nothing, and ingredient names aggregate across entries.
 * If any of these break, the breakdown would show numbers the user never logged.
 */

const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe("deriveIngredientBreakdown — recipe entry scale + reconcile", () => {
  it("scales ingredient rows by portion_multiplier and reconciles to the stored total", () => {
    // Recipe base servings: 2 ingredients with 20g + 10g protein (30g total).
    // Logged at portion_multiplier 1.5 → stored protein 45g.
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Dinner",
        recipeTitle: "Chicken Bowl",
        recipeId: "r1",
        portionMultiplier: 1.5,
        protein: 45,
      }),
    ];
    const ingredients: BreakdownIngredientRow[] = [
      toBreakdownIngredientRow({ recipeId: "r1", name: "Chicken", protein: 20 }),
      toBreakdownIngredientRow({ recipeId: "r1", name: "Rice", protein: 10 }),
    ];

    const { lines, total } = deriveIngredientBreakdown(entries, ingredients, "protein");

    // Scaled: [30, 15] sum 45; reconcile factor 45/45 = 1 → unchanged share.
    expect(total).toBeCloseTo(45, 6);
    const chicken = lines.find((l) => l.name === "Chicken");
    const rice = lines.find((l) => l.name === "Rice");
    expect(chicken?.value).toBeCloseTo(30, 6);
    expect(rice?.value).toBeCloseTo(15, 6);
    // Parts equal the whole the user logged.
    expect(close(lines.reduce((s, l) => s + l.value, 0), 45)).toBe(true);
    expect(chicken?.isFallback).toBe(false);
  });

  it("reconciles to the stored total when the recipe was edited after logging", () => {
    // The recipe's live ingredient rows now sum to 60g protein at base servings,
    // but the entry was logged when the recipe only totalled 30g (stored=30).
    // Reconciliation must pin the displayed rows to the stored 30g, not 60g.
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Lunch",
        recipeTitle: "Salad",
        recipeId: "r1",
        portionMultiplier: 1,
        protein: 30, // stored total = what the user actually logged
      }),
    ];
    const ingredients: BreakdownIngredientRow[] = [
      toBreakdownIngredientRow({ recipeId: "r1", name: "Tofu", protein: 40 }),
      toBreakdownIngredientRow({ recipeId: "r1", name: "Beans", protein: 20 }),
    ];

    const { lines, total } = deriveIngredientBreakdown(entries, ingredients, "protein");

    // scaledSum = 60, factor = 30/60 = 0.5 → [20, 10], sum = 30 (the stored total).
    expect(total).toBeCloseTo(30, 6);
    expect(lines.find((l) => l.name === "Tofu")?.value).toBeCloseTo(20, 6);
    expect(lines.find((l) => l.name === "Beans")?.value).toBeCloseTo(10, 6);
    expect(close(lines.reduce((s, l) => s + l.value, 0), 30)).toBe(true);
  });

  it("emits 0-value ingredient lines (not a fallback) when the macro is genuinely absent", () => {
    // Fat-free recipe viewed under the 'fat' macro: stored fat 0, base rows 0.
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Snack",
        recipeTitle: "Fruit Salad",
        recipeId: "r1",
        portionMultiplier: 1,
        fat: 0,
      }),
    ];
    const ingredients: BreakdownIngredientRow[] = [
      toBreakdownIngredientRow({ recipeId: "r1", name: "Apple", fat: 0 }),
      toBreakdownIngredientRow({ recipeId: "r1", name: "Banana", fat: 0 }),
    ];

    const { lines, total } = deriveIngredientBreakdown(entries, ingredients, "fat");
    expect(total).toBeCloseTo(0, 6);
    // Both ingredients still listed (composition visible), each at 0, not folded
    // into a single self-named fallback line.
    expect(lines.map((l) => l.name).sort()).toEqual(["Apple", "Banana"]);
    expect(lines.every((l) => l.value === 0 && !l.isFallback)).toBe(true);
  });
});

describe("deriveIngredientBreakdown — degenerate fallback", () => {
  it("renders a single self-named line for a single-food entry (no recipeId)", () => {
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Snack",
        recipeTitle: "Greek Yogurt",
        recipeId: null,
        portionMultiplier: 1,
        protein: 17,
      }),
    ];

    const { lines, total } = deriveIngredientBreakdown(entries, [], "protein");
    expect(total).toBeCloseTo(17, 6);
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Greek Yogurt");
    expect(lines[0].value).toBeCloseTo(17, 6);
    expect(lines[0].isFallback).toBe(true);
  });

  it("falls back when the recipe was deleted after logging (recipe_id SET NULL)", () => {
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Dinner",
        recipeTitle: "Old Recipe",
        recipeId: null, // deleted recipe → FK SET NULL
        portionMultiplier: 2,
        carbs: 50,
      }),
    ];
    // Even if ingredient rows for some OTHER recipe are present, this entry has
    // no recipeId so it must still fall back, never borrow another recipe's rows.
    const ingredients: BreakdownIngredientRow[] = [
      toBreakdownIngredientRow({ recipeId: "r999", name: "Stray", carbs: 99 }),
    ];

    const { lines, total } = deriveIngredientBreakdown(entries, ingredients, "carbs");
    expect(total).toBeCloseTo(50, 6);
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Old Recipe");
    expect(lines[0].value).toBeCloseTo(50, 6);
    expect(lines[0].isFallback).toBe(true);
  });

  it("falls back when a recipeId is present but the recipe has zero ingredient rows", () => {
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Lunch",
        recipeTitle: "Mystery Meal",
        recipeId: "r1",
        portionMultiplier: 1,
        calories: 600,
      }),
    ];
    // No rows for r1 in the ingredient set.
    const { lines, total } = deriveIngredientBreakdown(entries, [], "calories");
    expect(total).toBeCloseTo(600, 6);
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Mystery Meal");
    expect(lines[0].isFallback).toBe(true);
  });

  it("uses the slot name when the recipe title is empty", () => {
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Breakfast",
        recipeTitle: "",
        recipeId: null,
        portionMultiplier: 1,
        protein: 5,
      }),
    ];
    const { lines } = deriveIngredientBreakdown(entries, [], "protein");
    expect(lines[0].name).toBe("Breakfast");
  });
});

describe("deriveIngredientBreakdown — aggregation across entries", () => {
  it("aggregates the same ingredient name across two entries of different recipes", () => {
    // Two logged recipes both contain "Olive oil"; the breakdown sums them into
    // one line.
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Lunch",
        recipeTitle: "Pasta",
        recipeId: "r1",
        portionMultiplier: 1,
        fat: 14,
      }),
      toBreakdownEntry({
        id: "e2",
        name: "Dinner",
        recipeTitle: "Stir Fry",
        recipeId: "r2",
        portionMultiplier: 1,
        fat: 20,
      }),
    ];
    const ingredients: BreakdownIngredientRow[] = [
      // r1: Pasta 4g fat + Olive oil 10g fat = 14g (matches stored)
      toBreakdownIngredientRow({ recipeId: "r1", name: "Pasta", fat: 4 }),
      toBreakdownIngredientRow({ recipeId: "r1", name: "Olive oil", fat: 10 }),
      // r2: Veg 5g fat + Olive oil 15g fat = 20g (matches stored)
      toBreakdownIngredientRow({ recipeId: "r2", name: "Veg", fat: 5 }),
      toBreakdownIngredientRow({ recipeId: "r2", name: "Olive oil", fat: 15 }),
    ];

    const { lines, total } = deriveIngredientBreakdown(entries, ingredients, "fat");

    // Total across both entries' stored fat = 34.
    expect(total).toBeCloseTo(34, 6);
    const oil = lines.find((l) => l.name === "Olive oil");
    expect(oil).toBeDefined();
    expect(oil?.value).toBeCloseTo(25, 6); // 10 + 15
    // Sorted descending: Olive oil (25) first.
    expect(lines[0].name).toBe("Olive oil");
    // Still sums to the logged whole.
    expect(close(lines.reduce((s, l) => s + l.value, 0), 34)).toBe(true);
  });

  it("treats a non-positive / non-finite portion_multiplier as 1x rather than zeroing the entry", () => {
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Lunch",
        recipeTitle: "Soup",
        recipeId: "r1",
        portionMultiplier: 0, // bad data
        protein: 12,
      }),
    ];
    const ingredients: BreakdownIngredientRow[] = [
      toBreakdownIngredientRow({ recipeId: "r1", name: "Lentils", protein: 8 }),
      toBreakdownIngredientRow({ recipeId: "r1", name: "Stock", protein: 4 }),
    ];
    const { lines, total } = deriveIngredientBreakdown(entries, ingredients, "protein");
    // Reconciles to stored 12 regardless: scaled at 1x = [8,4] sum 12, factor 1.
    expect(total).toBeCloseTo(12, 6);
    expect(lines.find((l) => l.name === "Lentils")?.value).toBeCloseTo(8, 6);
  });

  it("returns an empty breakdown for no entries", () => {
    const { lines, total } = deriveIngredientBreakdown([], [], "protein");
    expect(lines).toHaveLength(0);
    expect(total).toBe(0);
  });
});

describe("deriveIngredientBreakdown — AI snapshot path (ENG-751)", () => {
  // An AI/photo/voice entry with persisted per-item snapshot rows.
  const aiEntry = (over: Partial<Parameters<typeof toBreakdownEntry>[0]> = {}) =>
    toBreakdownEntry({
      id: "ai1",
      name: "Lunch",
      recipeTitle: "Burrito bowl",
      recipeId: null, // AI meals have no recipe link
      portionMultiplier: 1,
      protein: 40,
      ...over,
    });

  const snap = (
    over: Partial<Parameters<typeof toBreakdownSnapshotRow>[0]> = {},
  ): BreakdownSnapshotRow =>
    toBreakdownSnapshotRow({
      entryId: "ai1",
      name: "Item",
      lowConfidence: false,
      protein: 0,
      ...over,
    });

  it("prefers snapshot rows over the single-line fallback when present + flag on", () => {
    const entries: BreakdownEntry[] = [aiEntry({ protein: 40 })];
    const snapshots: BreakdownSnapshotRow[] = [
      snap({ name: "Chicken", protein: 30 }),
      snap({ name: "Rice", protein: 10 }),
    ];
    const { lines, total } = deriveIngredientBreakdown(entries, [], "protein", {
      snapshots,
      preferSnapshot: true,
    });
    // Splits into one line per snapshot item, reconciled to the entry's stored 40.
    expect(total).toBeCloseTo(40, 6);
    expect(lines.map((l) => l.name).sort()).toEqual(["Chicken", "Rice"]);
    expect(lines.find((l) => l.name === "Chicken")?.value).toBeCloseTo(30, 6);
    expect(lines.find((l) => l.name === "Rice")?.value).toBeCloseTo(10, 6);
    expect(lines.every((l) => !l.isFallback)).toBe(true);
  });

  it("flag OFF keeps today's single-line fallback even when snapshot rows exist", () => {
    const entries: BreakdownEntry[] = [aiEntry({ protein: 40 })];
    const snapshots: BreakdownSnapshotRow[] = [
      snap({ name: "Chicken", protein: 30 }),
      snap({ name: "Rice", protein: 10 }),
    ];
    const { lines, total } = deriveIngredientBreakdown(entries, [], "protein", {
      snapshots,
      preferSnapshot: false, // display gate OFF — data is dark
    });
    expect(total).toBeCloseTo(40, 6);
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Burrito bowl");
    expect(lines[0].isFallback).toBe(true);
  });

  it("reconciles snapshot rows to the entry's stored total (commit-time rounding drift)", () => {
    // Snapshot items sum to 50g protein, but the entry column stored 45 (rounded
    // differently at commit). Display must pin to the stored 45 — the logged whole.
    const entries: BreakdownEntry[] = [aiEntry({ protein: 45 })];
    const snapshots: BreakdownSnapshotRow[] = [
      snap({ name: "Steak", protein: 35 }),
      snap({ name: "Beans", protein: 15 }),
    ];
    const { lines, total } = deriveIngredientBreakdown(entries, [], "protein", {
      snapshots,
      preferSnapshot: true,
    });
    expect(total).toBeCloseTo(45, 6);
    // factor = 45/50 = 0.9 → [31.5, 13.5]
    expect(lines.find((l) => l.name === "Steak")?.value).toBeCloseTo(31.5, 6);
    expect(lines.find((l) => l.name === "Beans")?.value).toBeCloseTo(13.5, 6);
    expect(close(lines.reduce((s, l) => s + l.value, 0), 45)).toBe(true);
  });

  it("flags low-confidence snapshot lines (never drops them)", () => {
    const entries: BreakdownEntry[] = [aiEntry({ protein: 20 })];
    const snapshots: BreakdownSnapshotRow[] = [
      snap({ name: "Mystery sauce", protein: 5, lowConfidence: true }),
      snap({ name: "Tofu", protein: 15, lowConfidence: false }),
    ];
    const { lines } = deriveIngredientBreakdown(entries, [], "protein", {
      snapshots,
      preferSnapshot: true,
    });
    // The low-confidence item is present (not dropped) AND flagged.
    const sauce = lines.find((l) => l.name === "Mystery sauce");
    expect(sauce).toBeDefined();
    expect(sauce?.lowConfidence).toBe(true);
    expect(lines.find((l) => l.name === "Tofu")?.lowConfidence).toBe(false);
  });

  it("recipes keep the recipe-derived path — snapshots only apply to their own entry", () => {
    // A recipe entry (e1) and an AI entry (ai1) on the same day. Snapshot rows
    // target ai1 only; e1 must still derive from recipe_ingredients.
    const entries: BreakdownEntry[] = [
      toBreakdownEntry({
        id: "e1",
        name: "Dinner",
        recipeTitle: "Pasta",
        recipeId: "r1",
        portionMultiplier: 1,
        protein: 12,
      }),
      aiEntry({ protein: 8 }),
    ];
    const ingredients: BreakdownIngredientRow[] = [
      toBreakdownIngredientRow({ recipeId: "r1", name: "Pasta", protein: 8 }),
      toBreakdownIngredientRow({ recipeId: "r1", name: "Cheese", protein: 4 }),
    ];
    const snapshots: BreakdownSnapshotRow[] = [snap({ name: "Sandwich", protein: 8 })];
    const { lines } = deriveIngredientBreakdown(entries, ingredients, "protein", {
      snapshots,
      preferSnapshot: true,
    });
    // Recipe ingredients present (recipe path), plus the AI snapshot line.
    expect(lines.find((l) => l.name === "Pasta")?.value).toBeCloseTo(8, 6);
    expect(lines.find((l) => l.name === "Cheese")?.value).toBeCloseTo(4, 6);
    expect(lines.find((l) => l.name === "Sandwich")?.value).toBeCloseTo(8, 6);
  });

  it("falls back to the single line when neither snapshot nor recipe rows exist", () => {
    const entries: BreakdownEntry[] = [aiEntry({ protein: 40 })];
    const { lines } = deriveIngredientBreakdown(entries, [], "protein", {
      snapshots: [],
      preferSnapshot: true,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe("Burrito bowl");
    expect(lines[0].isFallback).toBe(true);
  });

  it("emits 0-value snapshot lines (not a fallback) when the macro is genuinely absent", () => {
    // Fat-free AI item set viewed under the 'fat' macro.
    const entries: BreakdownEntry[] = [aiEntry({ protein: 0, fat: 0 })];
    const snapshots: BreakdownSnapshotRow[] = [
      snap({ name: "Apple", fat: 0 }),
      snap({ name: "Berries", fat: 0 }),
    ];
    const { lines, total } = deriveIngredientBreakdown(entries, [], "fat", {
      snapshots,
      preferSnapshot: true,
    });
    expect(total).toBeCloseTo(0, 6);
    expect(lines.map((l) => l.name).sort()).toEqual(["Apple", "Berries"]);
    expect(lines.every((l) => l.value === 0 && !l.isFallback)).toBe(true);
  });
});

describe("toBreakdownEntry / toBreakdownIngredientRow — normalisation", () => {
  it("defaults portion_multiplier to 1 and macros to 0 when null", () => {
    const e = toBreakdownEntry({ id: "e1", recipeId: null });
    expect(e.portionMultiplier).toBe(1);
    expect(e.protein).toBe(0);
    expect(e.recipeId).toBeNull();
    expect(e.name).toBe("");
  });

  it("coerces string-ish macro values to numbers", () => {
    const r = toBreakdownIngredientRow({
      recipeId: "r1",
      name: "X",
      protein: "12" as unknown as number,
    });
    expect(r.protein).toBe(12);
  });
});
