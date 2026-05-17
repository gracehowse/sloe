/**
 * Legacy MyFitnessPal CSV parser entry point.
 *
 * ENG-37 (2026-05-16) — the parser is now a thin shim over the
 * pluggable CSV-import framework at `src/lib/imports/csv/`. The
 * framework lets each new competitor format (Lose It, Cronometer,
 * MacroFactor, …) ship as a ~50-line adapter file rather than a
 * copy-paste of the whole parser. See `csv/types.ts` for the
 * adapter interface and `csv/adapters/mfp.ts` for the MFP config.
 *
 * Why keep this file as a shim:
 *   - `app/api/imports/mfp-csv/route.ts` and the web + mobile import
 *     UIs import `parseMfpCsv` / `mapMfpMealToSlot` / `MfpCsvRow`
 *     today. Keeping them re-exported here means the framework
 *     refactor lands without a coordinated route + UI change, and
 *     the existing 287-test `parseMfpCsv.test.ts` keeps locking the
 *     behaviour contract without modification.
 *   - When subsequent PRs add Lose It / Cronometer / MacroFactor,
 *     they'll wire the route through `parseCsvImport` (auto-detect)
 *     instead of `parseMfpCsv`. At that point this file can be
 *     deleted — the shim is intentionally a one-way bridge.
 */

import { mfpAdapter, mapMfpMealToSlot } from "./csv/adapters/mfp";
import { parseLocaleDate } from "./csv/csvPrimitives";
import { parseCsvWithAdapter } from "./csv/runCsvImport";

/**
 * One imported row as it lands in our system. `null` distinguishes
 * "missing in CSV" from "zero" so the import route can decide whether
 * to flag the entry as incomplete.
 *
 * Shape matches the original {@link MfpCsvRow} the route + UI expect.
 * The pluggable framework's {@link import("./csv/types").CanonicalImportRow}
 * adds `slot` and `fiber` fields — those are dropped here for
 * backwards compatibility.
 */
export type MfpCsvRow = {
  /** Local-date string in YYYY-MM-DD form (`parseLocaleDate` semantics). */
  date: string;
  /** Meal label as exported, trimmed. Empty string when MFP omitted it. */
  meal: string;
  /** Food name (verbatim from MFP — usually "Food, descriptor - Nx unit"). */
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sodium: number | null;
  sugar: number | null;
};

/**
 * Parse a full MFP CSV string. Returns the rows we could understand
 * and an array of warning messages for rows we skipped (missing date
 * or name, or unparseable structure).
 *
 * Internally delegates to the pluggable framework using the MFP
 * adapter — the framework now owns the CSV mechanics, while
 * `csv/adapters/mfp.ts` owns the MFP-specific knowledge.
 */
export function parseMfpCsv(input: string): {
  rows: MfpCsvRow[];
  warnings: string[];
} {
  const result = parseCsvWithAdapter(input, mfpAdapter);
  return {
    rows: result.rows.map((r) => ({
      date: r.date,
      meal: r.meal,
      name: r.name,
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      sodium: r.sodium,
      sugar: r.sugar,
    })),
    warnings: result.warnings,
  };
}

/**
 * Parse an MFP date cell. Re-exports {@link parseLocaleDate} which
 * handles ISO, US `m/d/yyyy`, and UK `d/m/yyyy` formats.
 */
export const parseMfpDate = parseLocaleDate;

/**
 * Re-export the MFP meal-label mapper from the adapter file. Old
 * call sites import `mapMfpMealToSlot` from this module directly.
 */
export { mapMfpMealToSlot };
