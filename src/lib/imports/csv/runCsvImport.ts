import {
  canonHeader,
  normaliseInput,
  parseIsoDate,
  parseNumberCell,
  splitCsvLine,
} from "./csvPrimitives";
import type {
  CanonicalImportRow,
  CsvColumnKey,
  CsvImportAdapter,
  CsvImportResult,
} from "./types";

/**
 * Generic CSV parser. Walks the input, finds the header row, builds
 * a column-index map from the adapter's header aliases, then emits
 * a {@link CanonicalImportRow} per data row. Adapter functions
 * (`parseDate`, `mapMeal`) hook in at the per-row level.
 *
 * Failure modes (all non-throwing — surfaced as warnings):
 *   - empty input → `["empty_file"]`
 *   - no parseable header row → `["no_header"]`
 *   - header row missing one or more required columns → `["missing_required_columns"]`
 *   - row with empty required cell → `["row_N_missing_<col>"]`
 *
 * The result's `source` field comes from the adapter so callers
 * (analytics, UI labels) can tell which adapter handled the file.
 */
export function parseCsvWithAdapter(
  input: string,
  adapter: CsvImportAdapter,
): CsvImportResult {
  const rows: CanonicalImportRow[] = [];
  const warnings: string[] = [];

  const text = normaliseInput(input);
  if (!text.trim()) {
    return { source: adapter.source, rows, warnings: ["empty_file"] };
  }

  const lines = text.split("\n");

  // Find the first non-empty line — that's the header.
  let headerLineIdx = -1;
  let rawHeaders: string[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const split = splitCsvLine(lines[i]);
    if (split) {
      rawHeaders = split.map((c) => c.trim());
      headerLineIdx = i;
      break;
    }
  }
  if (!rawHeaders || headerLineIdx === -1) {
    return { source: adapter.source, rows, warnings: ["no_header"] };
  }

  const idx = indexHeaders(rawHeaders, adapter);
  const required = adapter.requiredColumns ?? (["date", "name"] as const);
  const missing = required.filter((k) => idx[k] === undefined);
  if (missing.length > 0) {
    warnings.push("missing_required_columns");
    return { source: adapter.source, rows, warnings };
  }

  const dateParser = adapter.parseDate ?? parseIsoDate;

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (!cells) continue;

    const dateIdx = idx.date;
    const nameIdx = idx.name;
    const dateRaw =
      dateIdx !== undefined ? (cells[dateIdx] ?? "").trim() : "";
    const name = nameIdx !== undefined ? (cells[nameIdx] ?? "").trim() : "";

    // Fully empty content row.
    if (!dateRaw && !name) continue;

    // Required-field gating. Adapters with non-default `requiredColumns`
    // already passed the header-level check above; here we check the
    // cell-level presence on date / name (the universal must-haves).
    if (required.includes("date") && !dateRaw) {
      warnings.push(`row_${i + 1}_missing_date`);
      continue;
    }
    if (required.includes("name") && !name) {
      warnings.push(`row_${i + 1}_missing_name`);
      continue;
    }

    const meal =
      idx.meal !== undefined ? (cells[idx.meal] ?? "").trim() : "";
    const slot = adapter.mapMeal ? adapter.mapMeal(meal) : null;

    rows.push({
      date: dateParser(dateRaw),
      meal,
      slot,
      name,
      calories: numAt(cells, idx, "calories"),
      protein: numAt(cells, idx, "protein"),
      carbs: numAt(cells, idx, "carbs"),
      fat: numAt(cells, idx, "fat"),
      sodium: numAt(cells, idx, "sodium"),
      sugar: numAt(cells, idx, "sugar"),
      fiber: numAt(cells, idx, "fiber"),
    });
  }

  return { source: adapter.source, rows, warnings };
}

/** Build a `canonical-column → source-column-index` map by matching
 *  the source's raw headers against the adapter's alias table.
 *  Returns a partial — caller checks for missing required columns. */
function indexHeaders(
  rawHeaders: string[],
  adapter: CsvImportAdapter,
): Partial<Record<CsvColumnKey, number>> {
  const idx: Partial<Record<CsvColumnKey, number>> = {};
  const canon = rawHeaders.map((h) => canonHeader(h));

  for (const [key, aliases] of Object.entries(adapter.headers)) {
    if (!aliases) continue;
    for (let i = 0; i < canon.length; i++) {
      if (aliases.includes(canon[i]) && idx[key as CsvColumnKey] === undefined) {
        idx[key as CsvColumnKey] = i;
        break;
      }
    }
  }
  return idx;
}

/** Read a numeric cell from `cells` at the canonical-column index. */
function numAt(
  cells: string[],
  idx: Partial<Record<CsvColumnKey, number>>,
  key: CsvColumnKey,
): number | null {
  const i = idx[key];
  if (i === undefined) return null;
  return parseNumberCell(cells[i]);
}
