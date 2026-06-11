import { describe, expect, it } from "vitest";
import {
  matchHistoryFoods,
  historyMatchKeySet,
  dedupeDbAgainstHistory,
  HISTORY_MATCH_CAP,
  type HistorySearchItem,
} from "@/lib/nutrition/foodHistorySearch";
import { foodHistoryKey } from "@/lib/nutrition/foodHistory";

/** Helper: build a history item quickly. */
function hist(
  recipeTitle: string,
  calories: number,
  extras: Partial<HistorySearchItem> = {},
): HistorySearchItem {
  return {
    recipeTitle,
    calories,
    protein: extras.protein ?? 10,
    carbs: extras.carbs ?? 20,
    fat: extras.fat ?? 5,
    ...extras,
  };
}

describe("matchHistoryFoods — substring + case/diacritic insensitivity", () => {
  const items = [
    hist("Sourdough", 180),
    hist("Smartfood popcorn", 160),
    hist("MyFitnessPal entry", 250),
    hist("Greek yogurt", 120),
  ];

  it("returns [] for an empty / whitespace query", () => {
    expect(matchHistoryFoods(items, "")).toEqual([]);
    expect(matchHistoryFoods(items, "   ")).toEqual([]);
  });

  it("returns [] for empty history", () => {
    expect(matchHistoryFoods([], "sour")).toEqual([]);
  });

  it("matches a partial-word substring the token scorer alone would miss (sour → Sourdough)", () => {
    const out = matchHistoryFoods(items, "sour");
    expect(out.map((m) => m.item.recipeTitle)).toContain("Sourdough");
  });

  it("matches a brand substring (smart → Smartfood popcorn)", () => {
    const out = matchHistoryFoods(items, "smart");
    expect(out.map((m) => m.item.recipeTitle)).toContain("Smartfood popcorn");
  });

  it("is case-insensitive", () => {
    const upper = matchHistoryFoods(items, "SOUR");
    const lower = matchHistoryFoods(items, "sour");
    expect(upper.map((m) => m.item.recipeTitle)).toEqual(
      lower.map((m) => m.item.recipeTitle),
    );
  });

  it("is diacritic-insensitive both directions", () => {
    const withAccent = [hist("Pâté", 300), hist("Jalapeño poppers", 200)];
    expect(matchHistoryFoods(withAccent, "pate").map((m) => m.item.recipeTitle)).toContain(
      "Pâté",
    );
    expect(
      matchHistoryFoods(withAccent, "jalapeno").map((m) => m.item.recipeTitle),
    ).toContain("Jalapeño poppers");
  });

  it("excludes genuinely unrelated rows (no recall)", () => {
    const out = matchHistoryFoods(items, "sour");
    expect(out.map((m) => m.item.recipeTitle)).not.toContain("Greek yogurt");
  });

  it("ignores rows with a blank title", () => {
    const out = matchHistoryFoods([hist("   ", 100), hist("Sourdough", 180)], "sour");
    expect(out).toHaveLength(1);
    expect(out[0]!.item.recipeTitle).toBe("Sourdough");
  });
});

describe("matchHistoryFoods — recency-weighted frequency ordering", () => {
  it("ranks a more-frequent staple above a less-frequent one on a relevance tie", () => {
    // Identical title structure (same relevance score, exact-match) but
    // different kcal → distinct rows; the staple was logged far more often.
    // Frequency is the tiebreak, so the 20×-logged row wins.
    const items = [
      hist("Protein shake", 220, { count: 1 }),
      hist("Protein shake", 300, { count: 20 }),
    ];
    const out = matchHistoryFoods(items, "protein shake");
    expect(out[0]!.item.count).toBe(20);
  });

  it("breaks a frequency tie by recency (newest-first input position)", () => {
    // Equal count; the FIRST item in the input is the most recent.
    const items = [
      hist("Oat bar fresh", 200, { count: 3 }),
      hist("Oat bar stale", 200, { count: 3 }),
    ];
    const out = matchHistoryFoods(items, "oat bar");
    expect(out[0]!.item.recipeTitle).toBe("Oat bar fresh");
  });

  it("an exact-name match outranks a partial one regardless of frequency", () => {
    const items = [
      hist("Sourdough toast with butter", 350, { count: 50 }),
      hist("Sourdough", 180, { count: 1 }),
    ];
    const out = matchHistoryFoods(items, "sourdough");
    // Exact normalized match scores 1; the longer "containing" title scores
    // lower, so the exact row wins even though it was logged once.
    expect(out[0]!.item.recipeTitle).toBe("Sourdough");
  });
});

describe("matchHistoryFoods — de-dupe", () => {
  it("collapses identical (title, kcal) pairs to a single row, carrying the higher count", () => {
    const items = [
      hist("Sourdough", 180, { count: 1 }),
      hist("Sourdough", 180, { count: 9 }),
      hist("Sourdough", 180, { count: 2 }),
    ];
    const out = matchHistoryFoods(items, "sour");
    expect(out).toHaveLength(1);
    expect(out[0]!.key).toBe(foodHistoryKey("Sourdough", 180));
  });

  it("treats the same title with different kcal as distinct rows (matches the DB index)", () => {
    const items = [hist("Latte", 120), hist("Latte", 200)];
    const out = matchHistoryFoods(items, "latte");
    expect(out).toHaveLength(2);
  });
});

describe("matchHistoryFoods — cap", () => {
  it("caps the group at HISTORY_MATCH_CAP by default", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      hist(`Chicken meal ${i}`, 100 + i, { count: 12 - i }),
    );
    const out = matchHistoryFoods(items, "chicken");
    expect(out).toHaveLength(HISTORY_MATCH_CAP);
  });

  it("respects a custom cap", () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      hist(`Chicken meal ${i}`, 100 + i, { count: 12 - i }),
    );
    expect(matchHistoryFoods(items, "chicken", { cap: 3 })).toHaveLength(3);
  });

  it("a cap of 0 yields no rows", () => {
    expect(matchHistoryFoods([hist("Sourdough", 180)], "sour", { cap: 0 })).toEqual([]);
  });
});

describe("historyMatchKeySet + dedupeDbAgainstHistory — history wins over DB", () => {
  type DbRow = { name: string; kcal: number };
  const keyOf = (r: DbRow): string | null =>
    r.kcal > 0 ? foodHistoryKey(r.name, r.kcal) : null;

  it("drops a DB row that collides with a history match (shows once, history wins)", () => {
    const matches = matchHistoryFoods([hist("Sourdough", 180)], "sour");
    const keys = historyMatchKeySet(matches);
    const dbRows: DbRow[] = [
      { name: "Sourdough", kcal: 180 }, // collides with history
      { name: "Sourdough crackers", kcal: 130 }, // distinct
    ];
    const deduped = dedupeDbAgainstHistory(dbRows, keys, keyOf);
    expect(deduped.map((r) => r.name)).toEqual(["Sourdough crackers"]);
  });

  it("keeps all DB rows when there are no history matches", () => {
    const keys = historyMatchKeySet([]);
    const dbRows: DbRow[] = [{ name: "Sourdough", kcal: 180 }];
    expect(dedupeDbAgainstHistory(dbRows, keys, keyOf)).toHaveLength(1);
  });

  it("keeps a DB row it cannot positively key (never drops an un-dedupable result)", () => {
    const matches = matchHistoryFoods([hist("Sourdough", 180)], "sour");
    const keys = historyMatchKeySet(matches);
    const dbRows: DbRow[] = [{ name: "Sourdough", kcal: 0 }]; // keyOf → null
    expect(dedupeDbAgainstHistory(dbRows, keys, keyOf)).toHaveLength(1);
  });

  it("de-dupe key is case + diacritic-insensitive in line with the DB index", () => {
    const matches = matchHistoryFoods([hist("Sourdough", 180)], "sour");
    const keys = historyMatchKeySet(matches);
    // foodHistoryKey lowercases the title — a differently-cased DB row collides.
    const dbRows = [{ name: "SOURDOUGH", kcal: 180 }];
    const deduped = dedupeDbAgainstHistory(dbRows, keys, keyOf);
    expect(deduped).toHaveLength(0);
  });
});
