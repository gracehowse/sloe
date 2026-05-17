/**
 * Generic CSV-parsing primitives shared by every competitor adapter.
 *
 * These functions deliberately know NOTHING about MFP / Lose It /
 * Cronometer — they handle the universal mechanics of CSV (line
 * endings, quoting, header canonicalisation, number coercion). The
 * adapter layer (see `types.ts`) adds the format-specific knowledge
 * on top.
 *
 * Lifted from the original `parseMfpCsv.ts` so both the legacy MFP
 * path and the new generic pipeline share one implementation.
 */

/** Strip BOM, normalise CRLF / CR → LF. Returns the empty string for
 *  nullish input. */
export function normaliseInput(raw: string | null | undefined): string {
  let s = raw ?? "";
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  // CRLF first so we don't double-collapse.
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return s;
}

/**
 * RFC-4180-ish CSV row splitter. Handles quoted fields with commas
 * inside (`"Eggs, large"`) and double-quote escaping (`"She said ""hi"""`).
 * Returns `null` for an entirely empty line so callers can skip blanks
 * without an extra `.trim()` step.
 */
export function splitCsvLine(line: string): string[] | null {
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
  if (out.every((c) => c.trim() === "")) return null;
  return out;
}

/**
 * Canonicalise a header string for adapter-alias lookup. Lowercases
 * and strips non-alphanumerics, so `"Calories (kcal)"`, `"calories"`,
 * `"CALORIES"`, and `"Calories_kcal"` all collapse to the same key
 * `"calorieskcal"` or `"calories"` depending on the source. Adapters
 * list whichever canonical form matches the source.
 */
export function canonHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Coerce a CSV cell to a number, returning `null` for missing /
 * unparseable input rather than `0`. Strips thousands separators and
 * unit suffixes (`mg`, `g`, `kcal`, `kJ`). `null` propagates the
 * "missing from source" signal end-to-end; downstream display can
 * flag incomplete rows.
 */
export function parseNumberCell(raw: string | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/,/g, "").replace(/[^\d.\-eE]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * Parse an ISO-format date (`YYYY-MM-DD` or `YYYY/MM/DD`). Returns
 * `YYYY-MM-DD` on success, the trimmed input on failure so the caller
 * can decide what to do with the unparseable cell.
 *
 * This is the framework default. Adapters with locale formats (US
 * m/d/y, UK d/m/y) should provide their own `parseDate`.
 */
export function parseIsoDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (iso) {
    const y = iso[1];
    const m = iso[2].padStart(2, "0");
    const d = iso[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return s;
}

/**
 * Parse a date in MFP-style locale formats: tries ISO first, then
 * `m/d/yyyy` (US — the dominant MFP export convention), with a
 * day-first fallback when the first component would be an invalid
 * month. Returns the trimmed input on failure.
 *
 * Exposed so any adapter for a source that follows MFP's locale
 * convention (most US-origin trackers) can reuse it.
 */
export function parseLocaleDate(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const iso = parseIsoDate(s);
  if (iso !== s) return iso;
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    let y = parseInt(slash[3], 10);
    if (y < 100) y += 2000;
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
