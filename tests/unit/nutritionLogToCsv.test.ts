import { describe, expect, it } from "vitest";
import {
  nutritionLogToCsv,
  nutritionLogCsvFilename,
  NUTRITION_LOG_CSV_HEADER,
  type NutritionEntryRow,
} from "@/lib/export/nutritionLogToCsv";

/**
 * G-6 (TestFlight `AC4oDEnQ0SuPruUtCr_Lvyc`, 2026-04-19) — the CSV
 * path replaces JSON as the primary export for regular users. These
 * tests pin header shape, field mapping, and quoting so a regression
 * won't silently break spreadsheet imports.
 */
describe("nutritionLogToCsv", () => {
  const row: NutritionEntryRow = {
    date_key: "2026-04-18",
    time_label: "Lunch",
    name: "Lunch",
    recipe_title: "Chicken salad",
    portion_multiplier: 1,
    calories: 450,
    protein: 35.4,
    carbs: 20.1,
    fat: 18.2,
    fiber_g: 5.3,
    source: "USDA FoodData Central",
  };

  it("emits the header row in the documented order", () => {
    const csv = nutritionLogToCsv([row]);
    const [header] = csv.split("\r\n");
    expect(header).toBe(
      "date,meal_type,food_name,grams,calories,protein_g,carbs_g,fat_g,fibre_g,source",
    );
    expect(header!.split(",")).toEqual([...NUTRITION_LOG_CSV_HEADER]);
  });

  it("maps an entry row into one CSV line with the right columns", () => {
    const csv = nutritionLogToCsv([row]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    const cols = lines[1]!.split(",");
    expect(cols[0]).toBe("2026-04-18"); // date
    expect(cols[1]).toBe("Lunch");      // meal_type (time_label)
    expect(cols[2]).toBe("Chicken salad"); // food_name (recipe_title)
    expect(cols[3]).toBe("1");          // grams (portion_multiplier)
    expect(cols[4]).toBe("450");        // calories
    expect(cols[5]).toBe("35.4");       // protein
    expect(cols[6]).toBe("20.1");       // carbs
    expect(cols[7]).toBe("18.2");       // fat
    expect(cols[8]).toBe("5.3");        // fibre
    expect(cols[9]).toBe("USDA FoodData Central"); // source
  });

  it("quotes and doubles internal quotes in food names", () => {
    const csv = nutritionLogToCsv([
      { ...row, recipe_title: 'Mac "n" Cheese, Extra' },
    ]);
    expect(csv).toContain('"Mac ""n"" Cheese, Extra"');
  });

  it("quotes names containing commas", () => {
    const csv = nutritionLogToCsv([
      { ...row, recipe_title: "Salad, large" },
    ]);
    expect(csv).toContain('"Salad, large"');
  });

  it("quotes names containing newlines without breaking the row", () => {
    const csv = nutritionLogToCsv([
      { ...row, recipe_title: "Line1\nLine2" },
    ]);
    // the newline must be inside a quoted field, so overall row count
    // is header + (1 data row that internally contains a newline)
    const openCount = (csv.match(/"/g) ?? []).length;
    expect(openCount).toBeGreaterThanOrEqual(2);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("falls back to `name` when recipe_title is empty", () => {
    const csv = nutritionLogToCsv([
      { ...row, recipe_title: "", name: "Apple" },
    ]);
    const cols = csv.split("\r\n")[1]!.split(",");
    expect(cols[2]).toBe("Apple");
  });

  it("leaves numeric columns blank when missing", () => {
    const csv = nutritionLogToCsv([
      {
        date_key: "2026-04-18",
        time_label: "Snack",
        name: "Snack",
        recipe_title: "Banana",
        calories: 100,
        protein: null,
        carbs: undefined,
        fat: 0.5,
        fiber_g: null,
        source: null,
      },
    ]);
    const cols = csv.split("\r\n")[1]!.split(",");
    expect(cols[5]).toBe(""); // protein null
    expect(cols[6]).toBe(""); // carbs undefined
    expect(cols[7]).toBe("0.5");
    expect(cols[8]).toBe(""); // fibre null
    expect(cols[9]).toBe(""); // source null
  });

  it("preserves input order (no implicit sort)", () => {
    const rows: NutritionEntryRow[] = [
      { ...row, date_key: "2026-04-18", recipe_title: "First" },
      { ...row, date_key: "2026-04-17", recipe_title: "Second" },
      { ...row, date_key: "2026-04-19", recipe_title: "Third" },
    ];
    const csv = nutritionLogToCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[1]!).toContain("First");
    expect(lines[2]!).toContain("Second");
    expect(lines[3]!).toContain("Third");
  });

  it("returns just the header when there are no entries (non-empty output)", () => {
    const csv = nutritionLogToCsv([]);
    expect(csv).toBe(
      "date,meal_type,food_name,grams,calories,protein_g,carbs_g,fat_g,fibre_g,source",
    );
  });

  it("uses CRLF row separators so Excel on Windows parses cleanly", () => {
    const csv = nutritionLogToCsv([row]);
    expect(csv).toContain("\r\n");
    // exactly one CRLF between header and data row
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("builds an ISO-dated filename", () => {
    const name = nutritionLogCsvFilename(new Date("2026-04-18T23:10:00Z"));
    expect(name).toBe("suppr-nutrition-log-2026-04-18.csv");
  });
});
