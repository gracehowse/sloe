/**
 * nutritionLogToCsv — pure helper that serialises the user's full
 * `nutrition_entries` history into a spreadsheet-friendly CSV (G-6,
 * 2026-04-19, TestFlight `AC4oDEnQ0SuPruUtCr_Lvyc`).
 *
 * Tester feedback: "Does JSON make sense for a regular user? Shouldn't
 * it be CSV?" — JSON was kept as a secondary backup; CSV is now the
 * primary path for anyone who wants to open their log in Numbers,
 * Excel, or Google Sheets.
 *
 * v1 scope (narrow, on purpose):
 *   - One file covering the `nutrition_entries` table only.
 *   - Columns: date, meal_type, food_name, grams, calories, protein_g,
 *     carbs_g, fat_g, fibre_g, source.
 *   - Anything not in `nutrition_entries` (weight history, custom
 *     foods, saves, etc.) stays JSON-only for now — see the follow-up
 *     note in `resolved.md`.
 *
 * Quoting rules (RFC 4180-ish, Excel/Sheets compatible):
 *   - A field is quoted when it contains a comma, double-quote, CR, or LF.
 *   - Inside a quoted field, `"` is escaped as `""`.
 *   - Numeric fields are unquoted unless they contain any of the above
 *     (they won't, but the helper is a single path so it still checks).
 *   - The row separator is `\r\n`. Spreadsheets on every OS handle it.
 *
 * Structural + behavioural pins in `tests/unit/nutritionLogToCsv.test.ts`.
 */

export const NUTRITION_LOG_CSV_HEADER = [
  "date",
  "meal_type",
  "food_name",
  "grams",
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "fibre_g",
  "source",
] as const;

export type NutritionLogCsvColumn = (typeof NUTRITION_LOG_CSV_HEADER)[number];

/**
 * Shape of one row from `nutrition_entries` (see
 * `supabase/migrations/20260413100000_relational_user_data.sql`).
 * We keep the type permissive (`string | number | null | undefined`) so
 * callers can pass the raw Supabase response without pre-coercing.
 */
export interface NutritionEntryRow {
  date_key?: string | null;
  time_label?: string | null;
  name?: string | null;
  recipe_title?: string | null;
  portion_multiplier?: number | string | null;
  calories?: number | string | null;
  protein?: number | string | null;
  carbs?: number | string | null;
  fat?: number | string | null;
  fiber_g?: number | string | null;
  /**
   * ENG-1041 (audit 2026-06-11 P1-6) — the stored micros map. Read only as
   * a FALLBACK for `fiber_g`: foods logged via mobile food-search before
   * the fix persisted fibre in `nutrition_micros` but left the `fiber_g`
   * column null, so those historical rows exported BLANK fibre. The export
   * now backfills from `micros.fiberG` (matching `mealContributedFiberG`),
   * so a mobile-logged food exports the same non-null fibre as web.
   */
  nutrition_micros?: Record<string, number | null | undefined> | null;
  source?: string | null;
}

const NEEDS_QUOTING = /[",\r\n]/;

function csvField(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "string" ? value : String(value);
  if (NEEDS_QUOTING.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function roundOrBlank(n: unknown, digits = 0): string {
  if (n == null || n === "") return "";
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "";
  if (digits <= 0) return String(Math.round(num));
  const factor = 10 ** digits;
  return String(Math.round(num * factor) / factor);
}

/**
 * Recipe title is the primary human label when present (e.g. "Chicken
 * Salad"). `name` is the meal-slot label ("Lunch") and is a poor food
 * column on its own. Fall back to `name` so the row is never empty.
 */
function resolveFoodName(entry: NutritionEntryRow): string {
  const title = (entry.recipe_title ?? "").toString().trim();
  if (title) return title;
  const name = (entry.name ?? "").toString().trim();
  return name;
}

/**
 * `meal_type` reflects the slot the user logged the food against
 * (Breakfast / Lunch / Dinner / Snack). We read `time_label` first
 * because that's the explicit slot, and only fall back to `name` when
 * the slot is blank (matches how we store voice-logged / photo-logged
 * entries today).
 */
function resolveMealType(entry: NutritionEntryRow): string {
  const time = (entry.time_label ?? "").toString().trim();
  if (time) return time;
  const name = (entry.name ?? "").toString().trim();
  return name;
}

/**
 * `grams` column. We don't store a grams figure on `nutrition_entries`
 * — `portion_multiplier` is the closest signal. We expose it verbatim
 * (no invented weight) so the column is honest; for AI/photo logs it
 * will typically be blank. A future schema change can replace this with
 * a real grams value and we'll update the helper + tests together.
 */
function resolveGrams(entry: NutritionEntryRow): string {
  if (entry.portion_multiplier == null || entry.portion_multiplier === "") return "";
  const n = typeof entry.portion_multiplier === "number"
    ? entry.portion_multiplier
    : Number(entry.portion_multiplier);
  if (!Number.isFinite(n)) return "";
  return roundOrBlank(n, 2);
}

/**
 * ENG-1041 — fibre column value, with the `nutrition_micros` fallback.
 * Prefers the `fiber_g` column when it holds a finite, positive number;
 * otherwise reads `micros.fiberG`. Mirrors `mealContributedFiberG`
 * (`microNutrientDisplay.ts`) so the CSV agrees with the in-app daily
 * totals, and so mobile-logged rows (which historically left `fiber_g`
 * null) export the real value rather than a blank. Re-implemented here —
 * not imported — to keep this serialiser pure + dependency-free.
 */
function resolveFiberG(entry: NutritionEntryRow): string {
  const col =
    entry.fiber_g == null || entry.fiber_g === ""
      ? NaN
      : typeof entry.fiber_g === "number"
        ? entry.fiber_g
        : Number(entry.fiber_g);
  if (Number.isFinite(col) && col > 0) return roundOrBlank(col, 1);
  const fromMicros = entry.nutrition_micros?.fiberG;
  if (typeof fromMicros === "number" && Number.isFinite(fromMicros) && fromMicros > 0) {
    return roundOrBlank(fromMicros, 1);
  }
  // Preserve a legitimate zero from the column (e.g. a food with genuinely
  // 0 g fibre) rather than blanking it; only a null/absent column blanks.
  if (Number.isFinite(col)) return roundOrBlank(col, 1);
  return "";
}

/**
 * Turn a list of `nutrition_entries` rows into a CSV string.
 * The caller is responsible for sort order; we preserve input order.
 * Always returns at least the header line so the output file is
 * never empty (spreadsheets choke on zero-byte CSVs).
 */
export function nutritionLogToCsv(entries: readonly NutritionEntryRow[]): string {
  const header = NUTRITION_LOG_CSV_HEADER.join(",");
  const rows = entries.map((e) => {
    const cols: string[] = [
      csvField(e.date_key ?? ""),
      csvField(resolveMealType(e)),
      csvField(resolveFoodName(e)),
      csvField(resolveGrams(e)),
      csvField(roundOrBlank(e.calories, 0)),
      csvField(roundOrBlank(e.protein, 1)),
      csvField(roundOrBlank(e.carbs, 1)),
      csvField(roundOrBlank(e.fat, 1)),
      csvField(resolveFiberG(e)),
      csvField(e.source ?? ""),
    ];
    return cols.join(",");
  });
  return [header, ...rows].join("\r\n");
}

/**
 * Build a standard filename (`suppr-nutrition-log-YYYY-MM-DD.csv`) so
 * web + mobile download UX stay in sync. `now` is injectable for tests.
 */
export function nutritionLogCsvFilename(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  return `suppr-nutrition-log-${iso}.csv`;
}
