/**
 * Pluggable CSV-import framework tests (ENG-37).
 *
 * The framework lives at `src/lib/imports/csv/`. These tests lock:
 *
 *   1. Primitives (`normaliseInput`, `splitCsvLine`, `canonHeader`,
 *      `parseNumberCell`, `parseIsoDate`, `parseLocaleDate`) behave
 *      identically to the originals lifted from `parseMfpCsv.ts`.
 *   2. Generic parser (`parseCsvWithAdapter`) honours adapter
 *      requirements (`requiredColumns`, `parseDate`, `mapMeal`) and
 *      surfaces the right warnings.
 *   3. Adapter registry (`detectAdapter`, `getAdapterBySource`)
 *      dispatches correctly and survives a broken detector.
 *   4. Top-level (`parseCsvImport`) auto-detects MFP CSV and round-
 *      trips against the legacy `parseMfpCsv` for the same input.
 *
 * The legacy 26-test suite at `tests/unit/parseMfpCsv.test.ts` runs
 * against the shim and ensures the MFP behaviour contract is
 * preserved end-to-end. This file covers what's NEW in the
 * framework.
 */
import { describe, expect, it } from "vitest";
import {
  canonHeader,
  normaliseInput,
  parseIsoDate,
  parseLocaleDate,
  parseNumberCell,
  splitCsvLine,
} from "../../src/lib/imports/csv/csvPrimitives";
import { parseCsvWithAdapter } from "../../src/lib/imports/csv/runCsvImport";
import {
  REGISTERED_ADAPTERS,
  detectAdapter,
  getAdapterBySource,
} from "../../src/lib/imports/csv/adapters/registry";
import { parseCsvImport } from "../../src/lib/imports/csv/parseCsvImport";
import { parseMfpCsv } from "../../src/lib/imports/parseMfpCsv";
import type { CsvImportAdapter } from "../../src/lib/imports/csv/types";

describe("csvPrimitives — normaliseInput", () => {
  it("strips a UTF-8 BOM", () => {
    expect(normaliseInput("﻿abc")).toBe("abc");
  });
  it("normalises CRLF to LF", () => {
    expect(normaliseInput("a\r\nb")).toBe("a\nb");
  });
  it("normalises old-Mac CR to LF", () => {
    expect(normaliseInput("a\rb")).toBe("a\nb");
  });
  it("returns empty string for nullish input", () => {
    expect(normaliseInput(null)).toBe("");
    expect(normaliseInput(undefined)).toBe("");
  });
});

describe("csvPrimitives — splitCsvLine", () => {
  it("splits a basic row", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("preserves commas inside quoted fields", () => {
    expect(splitCsvLine('"Eggs, large",2')).toEqual(["Eggs, large", "2"]);
  });
  it("handles double-quote escaping inside quoted fields", () => {
    expect(splitCsvLine('"She said ""hi""",done')).toEqual([
      'She said "hi"',
      "done",
    ]);
  });
  it("returns null for an empty line", () => {
    expect(splitCsvLine("")).toBeNull();
  });
  it("returns null for an all-empty-cell line", () => {
    expect(splitCsvLine(",,,")).toBeNull();
  });
});

describe("csvPrimitives — canonHeader", () => {
  it("lowercases", () => {
    expect(canonHeader("CALORIES")).toBe("calories");
  });
  it("strips spaces", () => {
    expect(canonHeader("Total Fat")).toBe("totalfat");
  });
  it("strips parens and units", () => {
    expect(canonHeader("Calories (kcal)")).toBe("calorieskcal");
    expect(canonHeader("Sodium (mg)")).toBe("sodiummg");
  });
});

describe("csvPrimitives — parseNumberCell", () => {
  it("parses plain numbers", () => {
    expect(parseNumberCell("420")).toBe(420);
    expect(parseNumberCell("4.2")).toBe(4.2);
  });
  it("strips thousands separators", () => {
    expect(parseNumberCell("1,200")).toBe(1200);
  });
  it("strips unit suffixes", () => {
    expect(parseNumberCell("180 mg")).toBe(180);
    expect(parseNumberCell("420 kcal")).toBe(420);
  });
  it("returns null for empty / whitespace / missing input", () => {
    expect(parseNumberCell("")).toBeNull();
    expect(parseNumberCell("   ")).toBeNull();
    expect(parseNumberCell(undefined)).toBeNull();
  });
  it("returns null for unparseable input", () => {
    expect(parseNumberCell("abc")).toBeNull();
  });
});

describe("csvPrimitives — parseIsoDate", () => {
  it("parses YYYY-MM-DD verbatim", () => {
    expect(parseIsoDate("2024-08-12")).toBe("2024-08-12");
  });
  it("parses YYYY/MM/DD into hyphen form", () => {
    expect(parseIsoDate("2024/08/12")).toBe("2024-08-12");
  });
  it("zero-pads single-digit month/day", () => {
    expect(parseIsoDate("2024-8-1")).toBe("2024-08-01");
  });
  it("returns the trimmed input on parse failure", () => {
    expect(parseIsoDate("  bogus  ")).toBe("bogus");
  });
});

describe("csvPrimitives — parseLocaleDate", () => {
  it("falls back through ISO first", () => {
    expect(parseLocaleDate("2024-08-12")).toBe("2024-08-12");
  });
  it("parses US m/d/yyyy", () => {
    expect(parseLocaleDate("8/12/2024")).toBe("2024-08-12");
  });
  it("parses UK d/m/yyyy when first part is > 12", () => {
    expect(parseLocaleDate("13/8/2024")).toBe("2024-08-13");
  });
  it("expands 2-digit years to 20xx", () => {
    expect(parseLocaleDate("8/12/24")).toBe("2024-08-12");
  });
  it("returns the trimmed input on parse failure", () => {
    expect(parseLocaleDate("nope")).toBe("nope");
  });
});

// Build a minimal adapter for the generic-parser tests.
const minimalAdapter: CsvImportAdapter = {
  source: "test",
  displayName: "Test Adapter",
  headers: {
    date: ["date"],
    name: ["food"],
    calories: ["calories"],
  },
  detect: () => true,
};

describe("parseCsvWithAdapter — warnings", () => {
  it("returns empty_file for nullish / blank input", () => {
    expect(parseCsvWithAdapter("", minimalAdapter).warnings).toEqual([
      "empty_file",
    ]);
    expect(parseCsvWithAdapter("   \n  \n  ", minimalAdapter).warnings).toEqual(
      ["empty_file"],
    );
  });

  it("returns missing_required_columns when adapter's required keys aren't all present", () => {
    const result = parseCsvWithAdapter(
      "Date,Calories\n2024-01-01,500",
      minimalAdapter, // requires name (default)
    );
    expect(result.warnings).toContain("missing_required_columns");
    expect(result.rows).toEqual([]);
  });

  it("reports row-level missing-date warnings without dropping the rest", () => {
    const csv = [
      "Date,Food,Calories",
      "2024-01-01,Eggs,200",
      ",,300", // empty content — skipped silently
      ",NoDate,500", // has name but no date → warning
      "2024-01-02,Toast,150",
    ].join("\n");
    const result = parseCsvWithAdapter(csv, minimalAdapter);
    expect(result.rows.map((r) => r.name)).toEqual(["Eggs", "Toast"]);
    expect(result.warnings.some((w) => w.includes("missing_date"))).toBe(true);
  });
});

describe("parseCsvWithAdapter — adapter hooks", () => {
  it("uses the adapter's parseDate hook", () => {
    const adapter: CsvImportAdapter = {
      ...minimalAdapter,
      parseDate: () => "1999-12-31",
    };
    const result = parseCsvWithAdapter(
      "Date,Food,Calories\n2024-01-01,Eggs,200",
      adapter,
    );
    expect(result.rows[0].date).toBe("1999-12-31");
  });

  it("uses the adapter's mapMeal hook and emits slot", () => {
    const adapter: CsvImportAdapter = {
      ...minimalAdapter,
      headers: { ...minimalAdapter.headers, meal: ["meal"] },
      mapMeal: (raw) => (raw === "B" ? "breakfast" : null),
    };
    const result = parseCsvWithAdapter(
      "Date,Meal,Food,Calories\n2024-01-01,B,Eggs,200\n2024-01-01,X,Toast,150",
      adapter,
    );
    expect(result.rows[0].slot).toBe("breakfast");
    expect(result.rows[1].slot).toBeNull();
  });

  it("falls back to ISO date parser when adapter has no parseDate", () => {
    const result = parseCsvWithAdapter(
      "Date,Food,Calories\n2024/01/01,Eggs,200",
      minimalAdapter,
    );
    expect(result.rows[0].date).toBe("2024-01-01");
  });

  it("emits source from the adapter", () => {
    const result = parseCsvWithAdapter(
      "Date,Food,Calories\n2024-01-01,Eggs,200",
      minimalAdapter,
    );
    expect(result.source).toBe("test");
  });
});

describe("adapter registry", () => {
  it("MFP adapter is registered", () => {
    expect(REGISTERED_ADAPTERS.some((a) => a.source === "mfp")).toBe(true);
  });

  it("getAdapterBySource returns the matching adapter", () => {
    expect(getAdapterBySource("mfp")?.displayName).toBe("MyFitnessPal");
  });

  it("getAdapterBySource returns null for unknown source", () => {
    expect(getAdapterBySource("does-not-exist")).toBeNull();
  });

  it("detectAdapter recognises an MFP header row", () => {
    const headers = ["Date", "Meal", "Food", "Calories", "Carbs", "Fat", "Protein"];
    const adapter = detectAdapter(headers);
    expect(adapter?.source).toBe("mfp");
  });

  it("detectAdapter returns null when no adapter recognises the format", () => {
    const headers = ["Foo", "Bar", "Baz"];
    expect(detectAdapter(headers)).toBeNull();
  });

  it("detectAdapter recognises a Lose It header row", () => {
    const headers = [
      "Date",
      "Name",
      "Type",
      "Quantity",
      "Units",
      "Calories",
      "Fat (g)",
      "Cholesterol (mg)",
      "Sodium (mg)",
      "Carbohydrates (g)",
      "Fiber (g)",
      "Sugars (g)",
      "Protein (g)",
    ];
    const adapter = detectAdapter(headers);
    expect(adapter?.source).toBe("lose-it");
  });

  it("detectAdapter recognises a Cronometer header row", () => {
    const headers = [
      "Day",
      "Time",
      "Group",
      "Food Name",
      "Amount",
      "Energy (kcal)",
      "Fat (g)",
      "Protein (g)",
      "Carbs (g)",
      "Sodium (mg)",
    ];
    const adapter = detectAdapter(headers);
    expect(adapter?.source).toBe("cronometer");
  });

  it("detectAdapter — all three adapters mutually exclusive", () => {
    const mfpHeaders = ["Date", "Meal", "Food", "Calories", "Carbs", "Fat"];
    const loseItHeaders = [
      "Date",
      "Name",
      "Type",
      "Quantity",
      "Units",
      "Calories",
    ];
    const cronometerHeaders = [
      "Day",
      "Group",
      "Food Name",
      "Amount",
      "Energy (kcal)",
    ];
    expect(detectAdapter(mfpHeaders)?.source).toBe("mfp");
    expect(detectAdapter(loseItHeaders)?.source).toBe("lose-it");
    expect(detectAdapter(cronometerHeaders)?.source).toBe("cronometer");
  });
});

describe("parseCsvImport — top-level", () => {
  const MFP_CSV = [
    "Date,Meal,Food,Calories,Carbs,Fat,Protein,Sodium,Sugar",
    "2024-08-12,Breakfast,Oats with banana,420,68,10,14,180,18",
    "2024-08-12,Lunch,Chicken salad,540,42,18,52,820,8",
  ].join("\n");

  it("auto-detects MFP and parses", () => {
    const result = parseCsvImport(MFP_CSV);
    expect(result.source).toBe("mfp");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe("Oats with banana");
    expect(result.rows[0].slot).toBe("breakfast");
  });

  it("round-trips identically against the legacy parseMfpCsv shim", () => {
    const generic = parseCsvImport(MFP_CSV);
    const legacy = parseMfpCsv(MFP_CSV);
    expect(generic.rows.length).toBe(legacy.rows.length);
    // Every legacy field maps 1:1 onto the generic row.
    legacy.rows.forEach((legacyRow, i) => {
      const genericRow = generic.rows[i];
      expect(genericRow.date).toBe(legacyRow.date);
      expect(genericRow.meal).toBe(legacyRow.meal);
      expect(genericRow.name).toBe(legacyRow.name);
      expect(genericRow.calories).toBe(legacyRow.calories);
      expect(genericRow.protein).toBe(legacyRow.protein);
      expect(genericRow.carbs).toBe(legacyRow.carbs);
      expect(genericRow.fat).toBe(legacyRow.fat);
      expect(genericRow.sodium).toBe(legacyRow.sodium);
      expect(genericRow.sugar).toBe(legacyRow.sugar);
    });
  });

  it("returns unknown_source for an unrecognised format", () => {
    const result = parseCsvImport("Foo,Bar,Baz\n1,2,3");
    expect(result.source).toBe("unknown");
    expect(result.warnings).toEqual(["unknown_source"]);
    expect(result.rows).toEqual([]);
  });

  it("returns empty_file when input is blank", () => {
    const result = parseCsvImport("");
    expect(result.warnings).toEqual(["empty_file"]);
  });

  it("uses an explicit source when provided", () => {
    const result = parseCsvImport(MFP_CSV, "mfp");
    expect(result.source).toBe("mfp");
    expect(result.rows).toHaveLength(2);
  });

  it("returns unknown_source when explicit source isn't registered", () => {
    const result = parseCsvImport(MFP_CSV, "not-a-real-source");
    expect(result.source).toBe("not-a-real-source");
    expect(result.warnings).toEqual(["unknown_source"]);
    expect(result.rows).toEqual([]);
  });
});

describe("parseCsvImport — Lose It adapter", () => {
  // Realistic Lose It CSV — locale-aware US date, unit-suffixed
  // macro headers, Quantity + Units columns. Pulled from the public
  // Lose It export format docs.
  const LOSEIT_CSV = [
    "Date,Name,Type,Quantity,Units,Calories,Fat (g),Cholesterol (mg),Sodium (mg),Carbohydrates (g),Fiber (g),Sugars (g),Protein (g)",
    "8/12/2024,Oats with banana,Breakfast,1,Serving,420,10,0,180,68,8,18,14",
    "8/12/2024,Chicken salad,Lunch,1,Bowl,540,18,85,820,42,6,8,52",
    "8/12/2024,Almonds,Snacks,30,g,170,15,0,0,6,3,1,6",
  ].join("\n");

  it("auto-detects Lose It and parses 3 rows", () => {
    const result = parseCsvImport(LOSEIT_CSV);
    expect(result.source).toBe("lose-it");
    expect(result.rows).toHaveLength(3);
  });

  it("parses headers with unit suffixes (Fat (g), Sodium (mg))", () => {
    const result = parseCsvImport(LOSEIT_CSV);
    expect(result.rows[0]).toMatchObject({
      name: "Oats with banana",
      calories: 420,
      fat: 10,
      sodium: 180,
      carbs: 68,
      fiber: 8,
      sugar: 18,
      protein: 14,
    });
  });

  it("parses US locale dates (m/d/yyyy → YYYY-MM-DD)", () => {
    const result = parseCsvImport(LOSEIT_CSV);
    expect(result.rows[0].date).toBe("2024-08-12");
  });

  it("maps Type column to canonical slot", () => {
    const result = parseCsvImport(LOSEIT_CSV);
    expect(result.rows[0].slot).toBe("breakfast");
    expect(result.rows[1].slot).toBe("lunch");
    expect(result.rows[2].slot).toBe("snack");
  });

  it("explicit source 'lose-it' bypasses detection", () => {
    const result = parseCsvImport(LOSEIT_CSV, "lose-it");
    expect(result.source).toBe("lose-it");
    expect(result.rows).toHaveLength(3);
  });
});

describe("parseCsvImport — Cronometer adapter", () => {
  // Realistic Cronometer Servings CSV — `Day` not `Date`, `Group` not
  // `Meal`/`Type`, `Food Name` (two words), `Amount` (single column
  // with portion baked in as a string), ISO-format dates, unit-
  // suffixed macro headers.
  const CRONOMETER_CSV = [
    "Day,Time,Group,Food Name,Amount,Energy (kcal),Fat (g),Protein (g),Carbs (g),Sodium (mg),Fiber (g),Sugars (g)",
    "2024-08-12,08:30,Breakfast,Oats with banana,1 cup,420,10,14,68,180,8,18",
    "2024-08-12,12:30,Lunch,Chicken salad bowl,1 bowl,540,18,52,42,820,6,8",
    "2024-08-12,15:00,Snacks,Almonds,30 g,170,15,6,6,0,3,1",
  ].join("\n");

  it("auto-detects Cronometer and parses 3 rows", () => {
    const result = parseCsvImport(CRONOMETER_CSV);
    expect(result.source).toBe("cronometer");
    expect(result.rows).toHaveLength(3);
  });

  it("parses headers with unit suffixes (Energy (kcal), Sodium (mg))", () => {
    const result = parseCsvImport(CRONOMETER_CSV);
    expect(result.rows[0]).toMatchObject({
      name: "Oats with banana",
      calories: 420,
      fat: 10,
      protein: 14,
      carbs: 68,
      sodium: 180,
      fiber: 8,
      sugar: 18,
    });
  });

  it("parses ISO dates from the Day column", () => {
    const result = parseCsvImport(CRONOMETER_CSV);
    expect(result.rows[0].date).toBe("2024-08-12");
  });

  it("maps Group column to canonical slot", () => {
    const result = parseCsvImport(CRONOMETER_CSV);
    expect(result.rows[0].slot).toBe("breakfast");
    expect(result.rows[1].slot).toBe("lunch");
    expect(result.rows[2].slot).toBe("snack");
  });

  it("explicit source 'cronometer' bypasses detection", () => {
    const result = parseCsvImport(CRONOMETER_CSV, "cronometer");
    expect(result.source).toBe("cronometer");
    expect(result.rows).toHaveLength(3);
  });

  it("preserves the 'Food Name' two-word header (canonHeader collapses spaces)", () => {
    const result = parseCsvImport(CRONOMETER_CSV);
    // Sanity: the food-name column did land on the name field, not
    // some other slot (the worst-case bug would silently shift columns).
    expect(result.rows[2].name).toBe("Almonds");
    expect(result.rows[2].name).not.toBe("30 g"); // Amount column
    expect(result.rows[2].name).not.toBe("Snacks"); // Group column
  });
});

describe("parseCsvImport — MacroFactor adapter (ENG-710)", () => {
  // Realistic MacroFactor food diary export.
  // Columns: Date, Meal, Food, Serving Size, Servings, Calories,
  //          Protein (g), Carbohydrates (g), Fat (g), Fiber (g),
  //          Sugar (g), Sodium (mg).
  // Date: ISO YYYY-MM-DD (MacroFactor never emits locale formats).
  // Meal: Breakfast / Lunch / Dinner / Snack (user-renameable; common
  //       built-ins tested here).
  // Key distinguisher vs MFP: `Serving Size` + `Servings` columns.
  const MACROFACTOR_CSV = [
    "Date,Meal,Food,Serving Size,Servings,Calories,Protein (g),Carbohydrates (g),Fat (g),Fiber (g),Sugar (g),Sodium (mg)",
    "2024-08-12,Breakfast,Oats with banana,1 cup,1.0,420,14,68,10,8,18,180",
    "2024-08-12,Lunch,Chicken breast,100 g,1.5,248,46,0,6,0,0,122",
    "2024-08-12,Dinner,Brown rice,100 g,1.0,216,5,45,2,2,0,10",
    "2024-08-12,Snack,Almonds,30 g,1.0,170,6,6,15,3,1,0",
  ].join("\n");

  it("auto-detects MacroFactor and parses 4 rows", () => {
    const result = parseCsvImport(MACROFACTOR_CSV);
    expect(result.source).toBe("macrofactor");
    expect(result.rows).toHaveLength(4);
  });

  it("parses unit-suffixed macro headers (Protein (g), Carbohydrates (g))", () => {
    const result = parseCsvImport(MACROFACTOR_CSV);
    expect(result.rows[0]).toMatchObject({
      name: "Oats with banana",
      calories: 420,
      protein: 14,
      carbs: 68,
      fat: 10,
      fiber: 8,
      sugar: 18,
      sodium: 180,
    });
  });

  it("parses ISO dates without locale heuristics", () => {
    const result = parseCsvImport(MACROFACTOR_CSV);
    expect(result.rows.every((r) => r.date === "2024-08-12")).toBe(true);
  });

  it("maps Meal column to canonical slot", () => {
    const result = parseCsvImport(MACROFACTOR_CSV);
    expect(result.rows[0].slot).toBe("breakfast");
    expect(result.rows[1].slot).toBe("lunch");
    expect(result.rows[2].slot).toBe("dinner");
    expect(result.rows[3].slot).toBe("snack");
  });

  it("explicit source 'macrofactor' bypasses detection", () => {
    const result = parseCsvImport(MACROFACTOR_CSV, "macrofactor");
    expect(result.source).toBe("macrofactor");
    expect(result.rows).toHaveLength(4);
  });

  it("detectAdapter recognises a MacroFactor header row", () => {
    const headers = [
      "Date", "Meal", "Food", "Serving Size", "Servings", "Calories",
      "Protein (g)", "Carbohydrates (g)", "Fat (g)", "Fiber (g)", "Sodium (mg)",
    ];
    const adapter = detectAdapter(headers);
    expect(adapter?.source).toBe("macrofactor");
  });

  it("detectAdapter — MacroFactor is mutually exclusive with MFP, Lose It, Cronometer", () => {
    const mfpHeaders = ["Date", "Meal", "Food", "Calories", "Carbs", "Fat"];
    const loseItHeaders = ["Date", "Name", "Type", "Quantity", "Units", "Calories"];
    const cronometerHeaders = ["Day", "Group", "Food Name", "Amount", "Energy (kcal)"];
    const macrofactorHeaders = [
      "Date", "Meal", "Food", "Serving Size", "Servings",
      "Calories", "Protein (g)", "Carbohydrates (g)", "Fat (g)",
    ];
    expect(detectAdapter(mfpHeaders)?.source).toBe("mfp");
    expect(detectAdapter(loseItHeaders)?.source).toBe("lose-it");
    expect(detectAdapter(cronometerHeaders)?.source).toBe("cronometer");
    expect(detectAdapter(macrofactorHeaders)?.source).toBe("macrofactor");
  });

  it("Serving Size + Servings columns are ignored (macros already pre-multiplied)", () => {
    // Both rows have 1.5 servings; the calories/macros in the CSV are
    // already the total for the serving quantity — no multiplication
    // should be applied by the adapter.
    const csv = [
      "Date,Meal,Food,Serving Size,Servings,Calories,Protein (g),Carbohydrates (g),Fat (g)",
      "2024-08-12,Lunch,Chicken breast,100 g,1.5,248,46,0,6",
    ].join("\n");
    const result = parseCsvImport(csv);
    expect(result.rows[0].calories).toBe(248); // as-exported, not 248 × 1.5
    expect(result.rows[0].protein).toBe(46);
  });
});
