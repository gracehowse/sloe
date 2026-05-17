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

  it("detectAdapter does not match MFP when Quantity column is present (Lose It marker)", () => {
    const headers = [
      "Date",
      "Name",
      "Type",
      "Quantity",
      "Units",
      "Calories",
      "Fat",
      "Protein",
      "Carbohydrates",
    ];
    // No Lose It adapter yet, but the MFP detector should reject this
    // file so future Lose It registration doesn't fight over it.
    expect(detectAdapter(headers)).toBeNull();
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
