/**
 * MyFitnessPal CSV parser.
 *
 * Closes the MFP-refugee history-bridge gap (P1 customer-lens):
 * users coming from MyFitnessPal want to import history without
 * re-logging meals one by one.
 *
 * MFP exports vary slightly by region and account vintage but the
 * canonical shape is a row-per-meal-entry with at minimum:
 *
 *   Date, Meal, Food, Calories, Carbs, Fat, Protein
 *
 * Some exports also include Sodium, Sugar, Fiber, Cholesterol. We
 * pick up Sodium and Sugar when present (they're the two macros our
 * UI surfaces beyond the headline four).
 *
 * Robustness goals:
 *   - tolerate a UTF-8 BOM (`﻿`) at the start of the file
 *   - tolerate Windows CRLF and old-Mac CR line endings
 *   - tolerate column-header casing variations ("calories",
 *     "Calories", "CALORIES", "Calories (kcal)", etc.)
 *   - skip empty rows without crashing the import
 *   - keep partial rows: missing macros become `null`, not 0 (so
 *     downstream display can flag "incomplete from CSV" instead of
 *     silently treating a missing protein as 0g)
 *   - never silently drop a row whose date or food name is non-empty
 *
 * What this parser deliberately does NOT do:
 *   - guess macros (route to nutrition-engine via the API for that)
 *   - normalise meal labels (we preserve "Breakfast", "Lunch",
 *     "Dinner", "Snacks", "Snack", and any custom MFP slot the user
 *     created — the API maps these to our canonical slots)
 *   - parse quantities; MFP exports include the quantity inside the
 *     "Food" string ("Eggs, large - 2 large eggs"), so the macros are
 *     already pre-multiplied
 */

/**
 * One imported row as it lands in our system. `null` distinguishes
 * "missing in CSV" from "zero" so the import route can decide whether
 * to flag the entry as incomplete.
 */
export type MfpCsvRow = {
  /** Local-date string in YYYY-MM-DD form (UTC parsing — see {@link parseMfpDate}). */
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

/** Header keys we recognise. Lowercased + alphanumeric-only on lookup. */
const HEADER_KEYS = {
  date: ["date"],
  meal: ["meal", "mealtype"],
  name: ["food", "fooddescription", "name"],
  calories: ["calories", "energy", "kcal"],
  protein: ["protein", "proteing"],
  carbs: ["carbs", "carbohydrates", "carbohydrate"],
  fat: ["fat", "totalfat"],
  sodium: ["sodium", "sodiummg"],
  sugar: ["sugar", "sugars", "sugarg"],
} as const;

type ColumnKey = keyof typeof HEADER_KEYS;

/** Strip BOM, normalise CRLF / CR → LF. */
function normaliseInput(raw: string): string {
  let s = raw;
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  // Order matters: CRLF first so we don't double-collapse.
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return s;
}

/**
 * RFC-4180-ish CSV row splitter. Handles quoted fields with commas
 * inside ("Eggs, large") and double-quote escaping ("She said ""hi""").
 * Returns null for an entirely empty line.
 */
function splitCsvLine(line: string): string[] | null {
  if (!line) return null;
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  // All-empty row → treat as blank.
  if (out.every((c) => c.trim() === "")) return null;
  return out;
}

function canon(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Build a header → column-index map. Returns null if the date or
 * food-name column is missing (the two hard requirements; everything
 * else can be `null`).
 */
function indexHeaders(headers: string[]): Record<ColumnKey, number> | null {
  const idx: Partial<Record<ColumnKey, number>> = {};
  headers.forEach((h, i) => {
    const c = canon(h);
    (Object.keys(HEADER_KEYS) as ColumnKey[]).forEach((k) => {
      const aliases = HEADER_KEYS[k] as readonly string[];
      if (aliases.includes(c) && idx[k] === undefined) {
        idx[k] = i;
      }
    });
  });
  if (idx.date === undefined || idx.name === undefined) return null;
  return idx as Record<ColumnKey, number>;
}

/**
 * Parse an MFP date cell. MFP exports use locale formats:
 *   - "2024-08-12" (ISO — preferred and most reliable)
 *   - "8/12/2024" (US m/d/y)
 *   - "12/8/2024" (UK d/m/y) — ambiguous when day ≤ 12; we cannot
 *     disambiguate from a single row, so we default to ISO and US
 *     and fall back to returning the trimmed input unchanged if the
 *     parse fails. Downstream consumers should treat `date` as opaque
 *     when it doesn't match `YYYY-MM-DD`.
 *
 * Returns YYYY-MM-DD when we can parse with confidence, else the
 * original trimmed cell so the caller can decide what to do.
 */
export function parseMfpDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // ISO YYYY-MM-DD or YYYY/MM/DD
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, "0");
    const d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // US m/d/yyyy — only confidently when the first part exceeds 12 OR
  // when MFP-export convention is to use US format. We treat the
  // first part as month if it ≤ 12, falling back to day-first if month
  // would be impossible.
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    let y = parseInt(slash[3], 10);
    if (y < 100) y += 2000;
    // Day-first if month >12; month-first by default (MFP US export
    // is the dominant case).
    let mm = a;
    let dd = b;
    if (a > 12 && b <= 12) {
      mm = b;
      dd = a;
    }
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
  }
  return s;
}

function parseNumberCell(raw: string | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Strip thousands separators and units (mg, g, kcal, etc.).
  const cleaned = trimmed.replace(/,/g, "").replace(/[^\d.\-eE]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Parse a full MFP CSV string. Returns the rows we could understand
 * and an array of warning messages for rows we skipped (missing date
 * or name, or unparseable structure). Warnings are intentionally
 * concise — the API surface bubbles these up so the user can see why
 * `imported < total`.
 */
export function parseMfpCsv(input: string): {
  rows: MfpCsvRow[];
  warnings: string[];
} {
  const rows: MfpCsvRow[] = [];
  const warnings: string[] = [];

  const text = normaliseInput(input ?? "");
  if (!text.trim()) return { rows, warnings: ["empty_file"] };

  const lines = text.split("\n");
  // Find first non-empty line as the header.
  let headerLineIdx = -1;
  let headers: string[] | null = null;
  for (let i = 0; i < lines.length; i++) {
    const split = splitCsvLine(lines[i]);
    if (split) {
      headers = split.map((c) => c.trim());
      headerLineIdx = i;
      break;
    }
  }
  if (!headers || headerLineIdx === -1) {
    warnings.push("no_header");
    return { rows, warnings };
  }

  const idx = indexHeaders(headers);
  if (!idx) {
    warnings.push("missing_required_columns");
    return { rows, warnings };
  }

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (!cells) continue; // silently skip blank lines

    const dateRaw = cells[idx.date]?.trim() ?? "";
    const name = (cells[idx.name] ?? "").trim();
    if (!dateRaw && !name) {
      // Fully empty content row — skip.
      continue;
    }
    if (!dateRaw) {
      warnings.push(`row_${i + 1}_missing_date`);
      continue;
    }
    if (!name) {
      warnings.push(`row_${i + 1}_missing_name`);
      continue;
    }

    rows.push({
      date: parseMfpDate(dateRaw),
      meal: idx.meal !== undefined ? (cells[idx.meal] ?? "").trim() : "",
      name,
      calories: idx.calories !== undefined ? parseNumberCell(cells[idx.calories]) : null,
      protein: idx.protein !== undefined ? parseNumberCell(cells[idx.protein]) : null,
      carbs: idx.carbs !== undefined ? parseNumberCell(cells[idx.carbs]) : null,
      fat: idx.fat !== undefined ? parseNumberCell(cells[idx.fat]) : null,
      sodium: idx.sodium !== undefined ? parseNumberCell(cells[idx.sodium]) : null,
      sugar: idx.sugar !== undefined ? parseNumberCell(cells[idx.sugar]) : null,
    });
  }

  return { rows, warnings };
}

/**
 * Map an MFP meal label to one of our canonical slots. MFP allows
 * users to rename slots, so we accept the major built-ins plus a
 * handful of common renames seen in support tickets. Unknown labels
 * fall through to `"snack"` (least disruptive bucket).
 */
export function mapMfpMealToSlot(raw: string): "breakfast" | "lunch" | "dinner" | "snack" {
  const c = canon(raw);
  if (c.startsWith("break") || c === "morning" || c === "am") return "breakfast";
  if (c.startsWith("lunch") || c === "noon" || c === "midday") return "lunch";
  if (c.startsWith("dinner") || c.startsWith("supper") || c === "evening" || c === "pm") return "dinner";
  return "snack";
}
