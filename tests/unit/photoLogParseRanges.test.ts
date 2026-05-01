/**
 * Unit tests for `photoLogRanges.ts` — the model-output parser the
 * range-first photo-log API depends on (2026-05-01 re-architecture).
 *
 * These pin the parser's tolerance contract so a future model snapshot
 * that emits slightly different shapes (numbers as strings, single
 * point estimates, missing macros, missing addons) still produces a
 * usable response instead of falling through to "model_unparseable"
 * and re-introducing the "Couldn't analyse this food" failure mode.
 */
import { describe, it, expect } from "vitest";

import {
  formatRange,
  formatRangeKcal,
  groupItemsByCategory,
  parsePhotoLogRangedResponse,
  parseRange,
  rangedItemToLogged,
  rangeMidpoint,
  sumRanges,
} from "@/lib/nutrition/photoLogRanges";

describe("parseRange — number-or-range tolerance", () => {
  it("promotes a single number to a {low,high} range", () => {
    expect(parseRange(120)).toEqual({ low: 120, high: 120 });
  });

  it("coerces stringified numbers", () => {
    expect(parseRange("42")).toEqual({ low: 42, high: 42 });
    expect(parseRange({ low: "40", high: "50" })).toEqual({ low: 40, high: 50 });
  });

  it("accepts a {low, high} object", () => {
    expect(parseRange({ low: 40, high: 50 })).toEqual({ low: 40, high: 50 });
  });

  it("accepts {min, max} as alias for {low, high}", () => {
    expect(parseRange({ min: 10, max: 20 })).toEqual({ low: 10, high: 20 });
  });

  it("swaps reversed bounds", () => {
    expect(parseRange({ low: 50, high: 40 })).toEqual({ low: 40, high: 50 });
  });

  it("mirrors a single bound when the other is missing", () => {
    expect(parseRange({ low: 30 })).toEqual({ low: 30, high: 30 });
    expect(parseRange({ high: 30 })).toEqual({ low: 30, high: 30 });
  });

  it("returns null on null / undefined / NaN / negative", () => {
    expect(parseRange(null)).toBeNull();
    expect(parseRange(undefined)).toBeNull();
    expect(parseRange(NaN)).toBeNull();
    expect(parseRange(-5)).toBeNull();
    expect(parseRange("not a number")).toBeNull();
    expect(parseRange({})).toBeNull();
  });
});

describe("parsePhotoLogRangedResponse — the model-output schema parser", () => {
  it("parses Grace's screenshot fixture (charcuterie / mezze plate)", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          {
            name: "Pita",
            category: "Bread + dips",
            quantityHint: "1 piece",
            calories: { low: 120, high: 150 },
          },
          {
            name: "Hummus",
            category: "Bread + dips",
            quantityHint: "~2 tbsp",
            calories: { low: 70, high: 100 },
          },
          {
            name: "Tzatziki",
            category: "Bread + dips",
            quantityHint: "~2 tbsp",
            calories: { low: 40, high: 60 },
          },
          {
            name: "Cheese",
            category: "Protein + fats",
            quantityHint: "~40-50g",
            calories: { low: 160, high: 200 },
            protein: { low: 10, high: 13 },
            fat: { low: 13, high: 17 },
          },
          {
            name: "Salami",
            category: "Protein + fats",
            calories: { low: 120, high: 150 },
          },
          {
            name: "Half egg",
            category: "Protein + fats",
            calories: 35,
          },
          {
            name: "Olives",
            category: "Extras",
            calories: { low: 35, high: 50 },
          },
          {
            name: "Greek salad",
            category: "Extras",
            quantityHint: "with feta + some oil",
            calories: { low: 80, high: 120 },
          },
        ],
        addons: [
          {
            name: "Glass of red wine",
            hint: "if you're also having wine",
            calories: { low: 120, high: 150 },
          },
        ],
        notes: "Olive oil glaze on bread likely +30 kcal",
      },
      "gpt-4o-test",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    const r = outcome.response;
    expect(r.items).toHaveLength(8);
    // Single-number 35 kcal for half-egg promoted to {low:35,high:35}
    const halfEgg = r.items.find((i) => i.name === "Half egg")!;
    expect(halfEgg.calories).toEqual({ low: 35, high: 35 });
    // Plate total = sum of low/high across all items.
    expect(r.totalKcal).toEqual({
      low: 120 + 70 + 40 + 160 + 120 + 35 + 35 + 80,
      high: 150 + 100 + 60 + 200 + 150 + 35 + 50 + 120,
    });
    // Total-with-addons = total + addons.
    expect(r.totalKcalWithAddons).toEqual({
      low: r.totalKcal.low + 120,
      high: r.totalKcal.high + 150,
    });
    expect(r.notes).toMatch(/olive oil/i);
    expect(r.modelVersion).toBe("gpt-4o-test");
  });

  it("emits null for missing macros (model declined to estimate)", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          {
            name: "Mystery thing",
            category: "Extras",
            calories: { low: 50, high: 100 },
            // No protein/carbs/fat.
          },
        ],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.items[0].protein).toBeNull();
    expect(outcome.response.items[0].carbs).toBeNull();
    expect(outcome.response.items[0].fat).toBeNull();
  });

  it("drops the addons field entirely when none provided", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          { name: "Pita", category: "Bread + dips", calories: { low: 120, high: 150 } },
        ],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.addons).toBeUndefined();
    expect(outcome.response.totalKcalWithAddons).toBeUndefined();
  });

  it("derives `confidence` from range tightness when the model didn't supply it", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          // Tight range (~9% of midpoint) -> high.
          { name: "Tight", category: "Extras", calories: { low: 100, high: 110 } },
          // Medium spread (~33% of midpoint) -> medium.
          { name: "Medium", category: "Extras", calories: { low: 100, high: 140 } },
          // Wide spread (50% of midpoint) -> low.
          { name: "Wide", category: "Extras", calories: { low: 50, high: 150 } },
        ],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.items[0].confidence).toBe("high");
    expect(outcome.response.items[1].confidence).toBe("medium");
    expect(outcome.response.items[2].confidence).toBe("low");
  });

  it("respects an explicit confidence string from the model", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          // Explicit "low" overrides what range-tightness alone would
          // pick — the model knows things about the photo we don't.
          {
            name: "Sauce of indeterminate origin",
            category: "Extras",
            calories: { low: 100, high: 110 },
            confidence: "low",
          },
        ],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.items[0].confidence).toBe("low");
  });

  it("generates a stable id for items without one", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          { name: "Cheese", category: "Protein + fats", calories: 200 },
          { name: "Cheese", category: "Protein + fats", calories: 200 },
        ],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.items[0].id).not.toBe(outcome.response.items[1].id);
    expect(outcome.response.items[0].id).toMatch(/^ai-0/);
    expect(outcome.response.items[1].id).toMatch(/^ai-1/);
  });

  it("preserves an id supplied by the model", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          { id: "model-pita-7", name: "Pita", category: "Bread + dips", calories: 130 },
        ],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.items[0].id).toBe("model-pita-7");
  });

  it("defaults missing category to 'Other' rather than rejecting", () => {
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [{ name: "Some food", calories: { low: 100, high: 120 } }],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.items[0].category).toBe("Other");
  });

  it("returns kind:'unparseable' when the top-level shape is wrong", () => {
    expect(parsePhotoLogRangedResponse(null, "gpt-4o").kind).toBe("unparseable");
    expect(parsePhotoLogRangedResponse("string instead", "gpt-4o").kind).toBe("unparseable");
    // Object with no items array -> schema regression (model returned
    // wrong shape), distinct from "items: []".
    expect(parsePhotoLogRangedResponse({ totalKcal: 100 }, "gpt-4o").kind).toBe("unparseable");
  });

  it("returns kind:'no_items' when items[] parses to empty (no food detected)", () => {
    // Empty items array -> valid shape, just no food in photo.
    expect(parsePhotoLogRangedResponse({ items: [] }, "gpt-4o").kind).toBe("no_items");
    // All items invalid (no kcal field) -> filtered to empty -> no_items.
    const outcome = parsePhotoLogRangedResponse(
      { items: [{ name: "Foo" /* no calories */ }] },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("no_items");
  });

  it("never blanket-rejects when SOME items parse — partial input still ok", () => {
    // One valid item + one invalid -> ok with the valid one. This is
    // the central anti-blanket-fail invariant of the re-architecture.
    const outcome = parsePhotoLogRangedResponse(
      {
        items: [
          { name: "Pita", category: "Bread + dips", calories: { low: 120, high: 150 } },
          { name: "Mystery", category: "Extras" /* no kcal — drop */ },
        ],
      },
      "gpt-4o",
    );
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.response.items).toHaveLength(1);
    expect(outcome.response.items[0].name).toBe("Pita");
  });
});

describe("range helpers", () => {
  it("sumRanges sums low and high across a list", () => {
    expect(
      sumRanges([
        { low: 10, high: 20 },
        { low: 30, high: 40 },
      ]),
    ).toEqual({ low: 40, high: 60 });
  });

  it("sumRanges returns 0/0 for empty list", () => {
    expect(sumRanges([])).toEqual({ low: 0, high: 0 });
  });

  it("rangeMidpoint rounds the average", () => {
    expect(rangeMidpoint({ low: 100, high: 200 })).toBe(150);
    expect(rangeMidpoint({ low: 100, high: 101 })).toBe(101); // 100.5 -> rounds up
    expect(rangeMidpoint({ low: 50, high: 50 })).toBe(50);
  });

  it("formatRange uses an en-dash when low != high", () => {
    expect(formatRange({ low: 120, high: 150 })).toBe("~120–150");
  });

  it("formatRange collapses to a single number when low === high", () => {
    expect(formatRange({ low: 35, high: 35 })).toBe("~35");
  });

  it("formatRangeKcal appends the kcal suffix", () => {
    expect(formatRangeKcal({ low: 120, high: 150 })).toBe("~120–150 kcal");
    expect(formatRangeKcal({ low: 35, high: 35 })).toBe("~35 kcal");
  });
});

describe("groupItemsByCategory", () => {
  it("preserves the model's group order (first-seen wins)", () => {
    const grouped = groupItemsByCategory([
      { id: "1", name: "Pita", calories: { low: 120, high: 150 }, category: "Bread + dips", confidence: "high", source: "ai" },
      { id: "2", name: "Cheese", calories: { low: 160, high: 200 }, category: "Protein + fats", confidence: "high", source: "ai" },
      { id: "3", name: "Hummus", calories: { low: 70, high: 100 }, category: "Bread + dips", confidence: "high", source: "ai" },
      { id: "4", name: "Olives", calories: { low: 35, high: 50 }, category: "Extras", confidence: "high", source: "ai" },
    ]);
    expect(grouped.map((g) => g.category)).toEqual(["Bread + dips", "Protein + fats", "Extras"]);
    expect(grouped[0].items.map((i) => i.name)).toEqual(["Pita", "Hummus"]);
    expect(grouped[1].items.map((i) => i.name)).toEqual(["Cheese"]);
    expect(grouped[2].items.map((i) => i.name)).toEqual(["Olives"]);
  });

  it("returns an empty list for empty input", () => {
    expect(groupItemsByCategory([])).toEqual([]);
  });
});

describe("rangedItemToLogged — projection to journal commit shape", () => {
  it("collapses kcal range to midpoint and preserves the range on `range`", () => {
    const logged = rangedItemToLogged({
      id: "1",
      name: "Cheese",
      category: "Protein + fats",
      quantityHint: "~40-50g",
      calories: { low: 160, high: 200 },
      protein: { low: 10, high: 13 },
      carbs: null,
      fat: { low: 13, high: 17 },
      confidence: "medium",
      source: "ai",
    });
    expect(logged.calories).toBe(180);
    // Midpoint of 10/13 = 11.5 -> rounds to 12.
    expect(logged.protein).toBe(12);
    // Carbs missing in source -> 0 (existing pipeline contract).
    expect(logged.carbs).toBe(0);
    expect(logged.fat).toBe(15);
    // Original range preserved for UI / metadata.
    expect(logged.range.calories).toEqual({ low: 160, high: 200 });
    expect(logged.range.carbs).toBeNull();
    expect(logged.category).toBe("Protein + fats");
    expect(logged.quantityHint).toBe("~40-50g");
    expect(logged.unit).toBe("~40-50g");
    expect(logged.source).toBe("ai_photo");
  });

  it("maps confidence buckets to 0-1 such that 'low' trips the existing low-confidence wall", () => {
    const lowItem = rangedItemToLogged({
      id: "1",
      name: "Mystery",
      category: "Extras",
      calories: { low: 50, high: 250 },
      confidence: "low",
      source: "ai",
    });
    // 0.35 < 0.5 (LOW_CONFIDENCE_THRESHOLD) -> existing UI flags amber.
    expect(lowItem.confidence).toBeLessThan(0.5);

    const highItem = rangedItemToLogged({
      id: "2",
      name: "Pita",
      category: "Bread + dips",
      calories: { low: 120, high: 150 },
      confidence: "high",
      source: "ai",
    });
    expect(highItem.confidence).toBeGreaterThanOrEqual(0.75);
  });
});
