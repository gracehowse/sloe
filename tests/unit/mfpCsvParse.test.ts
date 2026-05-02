/**
 * Unit tests for `parseMfpCsv` — the CSV parser that backs
 * `/api/imports/mfp-csv`. Locks the contracts the import route relies
 * on:
 *   1. Header detection survives BOM, CRLF, and case variation.
 *   2. Missing macros become `null` (not 0) so downstream display
 *      can tell "incomplete from CSV" apart from "actually 0g".
 *   3. Empty lines are skipped, not treated as missing rows.
 *   4. Required-field gating: rows with no date or no name are
 *      reported as warnings, not silently dropped without a trace.
 */
import { describe, it, expect } from "vitest";
import {
  parseMfpCsv,
  parseMfpDate,
  mapMfpMealToSlot,
} from "../../src/lib/imports/mfpCsv";

const CANONICAL_HEADER =
  "Date,Meal,Food,Calories,Carbs,Fat,Protein,Sodium,Sugar";

/** 10 rows, 3 days, 3 meals each (last day has 4 entries — snack). */
const TEN_ROW_FIXTURE = [
  CANONICAL_HEADER,
  "2024-08-12,Breakfast,Oats with banana,420,68,10,14,180,18",
  "2024-08-12,Lunch,Chicken salad bowl,540,42,18,52,820,8",
  "2024-08-12,Dinner,Sheet-pan chicken,620,52,22,48,910,7",
  "2024-08-13,Breakfast,Greek yogurt parfait,310,38,8,22,95,28",
  "2024-08-13,Lunch,Tuna sandwich,480,46,16,32,720,5",
  "2024-08-13,Dinner,Pasta bolognese,710,82,22,36,940,11",
  "2024-08-14,Breakfast,Eggs and toast,450,32,22,28,580,4",
  "2024-08-14,Lunch,Burrito bowl,690,72,24,40,1100,6",
  "2024-08-14,Dinner,Salmon and rice,580,58,18,42,640,3",
  "2024-08-14,Snacks,Almonds 30g,170,6,15,6,0,1",
].join("\n");

describe("parseMfpCsv — happy path", () => {
  it("parses 10 rows with canonical headers and returns no warnings", () => {
    const { rows, warnings } = parseMfpCsv(TEN_ROW_FIXTURE);
    expect(rows).toHaveLength(10);
    expect(warnings).toEqual([]);
  });

  it("maps every field correctly on the first row", () => {
    const { rows } = parseMfpCsv(TEN_ROW_FIXTURE);
    expect(rows[0]).toEqual({
      date: "2024-08-12",
      meal: "Breakfast",
      name: "Oats with banana",
      calories: 420,
      carbs: 68,
      fat: 10,
      protein: 14,
      sodium: 180,
      sugar: 18,
    });
  });

  it("preserves 3 unique dates and 3 meal labels in distribution", () => {
    const { rows } = parseMfpCsv(TEN_ROW_FIXTURE);
    const dates = new Set(rows.map((r) => r.date));
    const meals = new Set(rows.map((r) => r.meal));
    expect(dates.size).toBe(3);
    // "Snacks" is a 4th label by design — locking that we don't
    // collapse meal types during parse.
    expect(meals.size).toBe(4);
  });
});

describe("parseMfpCsv — robustness", () => {
  it("strips a UTF-8 BOM at the start of the file", () => {
    const withBom = "﻿" + TEN_ROW_FIXTURE;
    const { rows } = parseMfpCsv(withBom);
    expect(rows).toHaveLength(10);
    expect(rows[0].name).toBe("Oats with banana");
  });

  it("handles Windows CRLF line endings", () => {
    const crlf = TEN_ROW_FIXTURE.replace(/\n/g, "\r\n");
    const { rows } = parseMfpCsv(crlf);
    expect(rows).toHaveLength(10);
    expect(rows[9].name).toBe("Almonds 30g");
  });

  it("handles legacy classic-Mac CR-only line endings", () => {
    const cr = TEN_ROW_FIXTURE.replace(/\n/g, "\r");
    const { rows } = parseMfpCsv(cr);
    expect(rows).toHaveLength(10);
  });

  it("accepts case variation in header names", () => {
    const csv = [
      "DATE,MEAL,FOOD,CALORIES,CARBS,FAT,PROTEIN,SODIUM,SUGAR",
      "2024-08-12,Breakfast,Eggs,140,1,9,12,140,0",
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].calories).toBe(140);
  });

  it("accepts header aliases like 'Energy', 'Carbohydrates', 'Total Fat'", () => {
    const csv = [
      "Date,Meal,Food Description,Energy,Carbohydrates,Total Fat,Protein",
      "2024-08-12,Lunch,Chicken,300,30,10,40",
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      calories: 300,
      carbs: 30,
      fat: 10,
      protein: 40,
      // Sodium and Sugar absent from this export → null.
      sodium: null,
      sugar: null,
    });
  });

  it("skips fully blank lines without warning", () => {
    const csv = [
      CANONICAL_HEADER,
      "",
      "2024-08-12,Breakfast,Oats,420,68,10,14,180,18",
      "",
      "",
      "2024-08-12,Lunch,Salad,540,42,18,52,820,8",
      "",
    ].join("\n");
    const { rows, warnings } = parseMfpCsv(csv);
    expect(rows).toHaveLength(2);
    expect(warnings).toEqual([]);
  });

  it("handles quoted commas inside the food name", () => {
    const csv = [
      CANONICAL_HEADER,
      '2024-08-12,Lunch,"Eggs, large - 2 each",140,1,9,12,140,0',
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows[0].name).toBe("Eggs, large - 2 each");
  });

  it("handles double-quote-escaped quotes inside the food name", () => {
    const csv = [
      CANONICAL_HEADER,
      '2024-08-12,Lunch,"Mom\'s ""special"" bowl",350,30,10,40,500,6',
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows[0].name).toBe('Mom\'s "special" bowl');
  });
});

describe("parseMfpCsv — edge cases", () => {
  it("returns null for missing macros, not 0", () => {
    const csv = [
      // Sodium and Sugar columns missing entirely.
      "Date,Meal,Food,Calories,Carbs,Fat,Protein",
      // Carbs cell is empty, fat cell is empty.
      "2024-08-12,Breakfast,Oats,420,,,14",
      "2024-08-12,Lunch,Chicken,500,40,15,",
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      calories: 420,
      carbs: null,
      fat: null,
      protein: 14,
      sodium: null,
      sugar: null,
    });
    expect(rows[1].protein).toBeNull();
  });

  it("treats whitespace-only macro cells as missing (null)", () => {
    const csv = [
      CANONICAL_HEADER,
      "2024-08-12,Lunch,Chicken,500,40,   ,30,800,5",
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows[0].fat).toBeNull();
  });

  it("strips thousands separators in numeric cells", () => {
    const csv = [
      CANONICAL_HEADER,
      '2024-08-12,Dinner,Steak feast,"1,200",30,80,90,"1,500",2',
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows[0].calories).toBe(1200);
    expect(rows[0].sodium).toBe(1500);
  });

  it("ignores units appended to numeric cells (e.g. 'mg', 'g')", () => {
    const csv = [
      CANONICAL_HEADER,
      "2024-08-12,Lunch,Chicken,540 kcal,42g,18g,52g,820mg,8g",
    ].join("\n");
    const { rows } = parseMfpCsv(csv);
    expect(rows[0].calories).toBe(540);
    expect(rows[0].carbs).toBe(42);
  });

  it("warns and skips a row missing the date cell", () => {
    const csv = [
      CANONICAL_HEADER,
      ",Breakfast,Oats,420,68,10,14,180,18",
      "2024-08-12,Lunch,Chicken,540,42,18,52,820,8",
    ].join("\n");
    const { rows, warnings } = parseMfpCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Chicken");
    expect(warnings.some((w) => w.includes("missing_date"))).toBe(true);
  });

  it("warns and skips a row missing the food name", () => {
    const csv = [
      CANONICAL_HEADER,
      "2024-08-12,Breakfast,,420,68,10,14,180,18",
      "2024-08-12,Lunch,Chicken,540,42,18,52,820,8",
    ].join("\n");
    const { rows, warnings } = parseMfpCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Chicken");
    expect(warnings.some((w) => w.includes("missing_name"))).toBe(true);
  });

  it("returns no_header for an empty file", () => {
    const { rows, warnings } = parseMfpCsv("");
    expect(rows).toEqual([]);
    expect(warnings).toContain("empty_file");
  });

  it("returns missing_required_columns when Date or Food is absent", () => {
    const csv = [
      "Calories,Carbs,Fat,Protein",
      "300,30,10,40",
    ].join("\n");
    const { rows, warnings } = parseMfpCsv(csv);
    expect(rows).toEqual([]);
    expect(warnings).toContain("missing_required_columns");
  });
});

describe("parseMfpDate", () => {
  it("normalises ISO YYYY-MM-DD to itself (zero-padded)", () => {
    expect(parseMfpDate("2024-8-2")).toBe("2024-08-02");
    expect(parseMfpDate("2024-08-12")).toBe("2024-08-12");
  });

  it("handles US m/d/yyyy", () => {
    expect(parseMfpDate("8/12/2024")).toBe("2024-08-12");
  });

  it("falls back to day-first when month would be invalid", () => {
    // 25 can't be a month, so day-first (d=25, m=8).
    expect(parseMfpDate("25/8/2024")).toBe("2024-08-25");
  });

  it("returns the trimmed input when unparseable", () => {
    expect(parseMfpDate("yesterday")).toBe("yesterday");
    expect(parseMfpDate("  ")).toBe("");
  });
});

describe("mapMfpMealToSlot", () => {
  it("maps the four built-in MFP labels", () => {
    expect(mapMfpMealToSlot("Breakfast")).toBe("breakfast");
    expect(mapMfpMealToSlot("Lunch")).toBe("lunch");
    expect(mapMfpMealToSlot("Dinner")).toBe("dinner");
    expect(mapMfpMealToSlot("Snacks")).toBe("snack");
  });

  it("handles common aliases", () => {
    expect(mapMfpMealToSlot("Supper")).toBe("dinner");
    expect(mapMfpMealToSlot("Morning")).toBe("breakfast");
    expect(mapMfpMealToSlot("Evening")).toBe("dinner");
  });

  it("falls through unknown labels to 'snack'", () => {
    expect(mapMfpMealToSlot("Pre-workout")).toBe("snack");
    expect(mapMfpMealToSlot("")).toBe("snack");
  });
});
