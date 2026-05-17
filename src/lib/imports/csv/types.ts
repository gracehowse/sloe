/**
 * Shared types for the pluggable CSV-import framework.
 *
 * ENG-37 — Suppr needs to capture refugees from 7 competitors beyond
 * MyFitnessPal (Lose It, Cronometer, MacroFactor, Cal AI, Paprika,
 * Recime, Honeydew). Each exports in a slightly different shape, but
 * the canonical row Suppr cares about is the same: date, meal, food
 * name, headline macros, plus a couple of optional micronutrients.
 *
 * Rather than copy-paste a parser per competitor, this framework
 * makes the parser generic and the per-competitor knowledge a small
 * adapter config: header aliases, date-format hint, meal-label map,
 * and a detector. Each new format becomes a ~50-line file under
 * `adapters/`.
 *
 * See `runCsvImport.ts` for the generic parser, and `adapters/mfp.ts`
 * for the canonical example.
 */

/**
 * The canonical row shape every adapter must produce. `null` (not 0)
 * distinguishes "missing in source" from "actually zero" — downstream
 * display flags incomplete rows instead of pretending zero-fat means
 * fat-free.
 */
export type CanonicalImportRow = {
  /** Local-date string in `YYYY-MM-DD` form. Empty string if the
   *  source row didn't carry a date. The adapter is responsible for
   *  date-format coercion; the framework treats the value as opaque. */
  date: string;
  /** Meal label as exported by the source, trimmed. Empty string when
   *  the source omitted it. {@link CsvImportAdapter.mapMeal} maps this
   *  to a canonical slot at parse time when defined. */
  meal: string;
  /** Canonical meal slot if the adapter provided a {@link CsvImportAdapter.mapMeal}
   *  function — otherwise `null` and the caller maps later. */
  slot: "breakfast" | "lunch" | "dinner" | "snack" | null;
  /** Food name verbatim from the source. */
  name: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sodium: number | null;
  sugar: number | null;
  fiber: number | null;
};

/** Canonical column keys the framework recognises. Adapters list one or
 *  more source-header aliases per key in their `headers` table. */
export type CsvColumnKey =
  | "date"
  | "meal"
  | "name"
  | "calories"
  | "protein"
  | "carbs"
  | "fat"
  | "sodium"
  | "sugar"
  | "fiber";

/**
 * Result of a CSV import parse. `source` identifies which adapter
 * handled the file (or `"unknown"` if detection failed). `warnings`
 * carries non-fatal issues — empty when parse was clean.
 */
export type CsvImportResult = {
  source: string;
  rows: CanonicalImportRow[];
  warnings: string[];
};

/**
 * A pluggable CSV-import adapter. Each competitor's export format
 * gets one of these. The framework handles CSV tokenisation, header
 * detection, number parsing, and the warnings array — the adapter
 * supplies only the source-specific knowledge:
 *
 *   - `headers`: which source-header strings map to which canonical
 *     column. Match is case-insensitive and alphanumeric-only after
 *     canonicalisation, so "Calories", "calories", and "Calories (kcal)"
 *     all canonicalise to `calories`.
 *   - `requiredColumns`: which canonical columns must be present for
 *     this adapter to handle the file. If any are missing, the
 *     framework returns a `missing_required_columns` warning and no
 *     rows. Defaults to `["date", "name"]` — the two columns every
 *     consumer (route + UI) treats as hard requirements.
 *   - `parseDate` (optional): override the default ISO-only date
 *     parser. Adapters for sources that export locale formats
 *     (US m/d/y, UK d/m/y) should set this.
 *   - `mapMeal` (optional): override the default meal-label mapper.
 *     Returns one of the canonical slot strings. If omitted, `slot`
 *     stays `null` on the output rows and the caller must map.
 *   - `detect`: header-row sniffer. Used by {@link detectAdapter} when
 *     the caller doesn't know which adapter to use. Should return
 *     true ONLY when this adapter is confident it handles the file —
 *     a permissive detector causes silent format misidentification,
 *     which is worse than no detection.
 */
export interface CsvImportAdapter {
  /** Stable machine identifier: `"mfp"`, `"lose-it"`, `"cronometer"`.
   *  Surfaces in `CsvImportResult.source` and in analytics events. */
  readonly source: string;
  /** Human-readable name surfaced in UI: `"MyFitnessPal"`, `"Lose It"`. */
  readonly displayName: string;
  /** Header aliases per canonical column. Aliases are canonicalised
   *  (lowercased, non-alphanumeric stripped) before lookup, so
   *  `"Calories (kcal)"` and `"calories"` both match the alias
   *  `"calories"`. */
  readonly headers: Readonly<Partial<Record<CsvColumnKey, readonly string[]>>>;
  /** Which canonical columns the adapter requires in the source.
   *  Defaults to `["date", "name"]`. Adapters can tighten this. */
  readonly requiredColumns?: readonly CsvColumnKey[];
  /** Optional date parser; defaults to ISO-only (`YYYY-MM-DD` or
   *  `YYYY/MM/DD`). Receives the trimmed cell string, returns either
   *  a `YYYY-MM-DD` string or the unchanged input if the parse fails. */
  readonly parseDate?: (raw: string) => string;
  /** Optional meal-label-to-slot mapper. Returns one of the canonical
   *  slot strings or `null` for "unknown / leave to caller". */
  readonly mapMeal?: (
    raw: string,
  ) => "breakfast" | "lunch" | "dinner" | "snack" | null;
  /** Header-row sniffer. Receives the canonicalised header list and
   *  the raw header strings (in source order). Returns true ONLY when
   *  this adapter is confident it handles the file. */
  readonly detect: (canonicalHeaders: string[], rawHeaders: string[]) => boolean;
}
