/**
 * POST /api/imports/mfp-csv — bulk import a MyFitnessPal CSV export.
 *
 * Closes the MFP-refugee history-bridge gap (P1 customer-lens). MFP
 * users land on Suppr with months/years of meal history in CSV form;
 * without an importer they would have to either re-log or ditch their
 * history entirely. This route ingests the CSV, maps each row to a
 * `nutrition_entries` insert, and reports back what landed.
 *
 * Decisions:
 *   - Pure server-side parse + insert. We do not re-derive macros from
 *     ingredient strings — the CSV macros are MFP's pre-multiplied
 *     totals for the meal entry, so re-deriving would double-count
 *     (and most MFP rows do not have a parseable ingredient list to
 *     begin with).
 *   - We DO NOT re-run name matching against USDA / OFF / FatSecret
 *     synchronously. Per-row enrichment for a 1k-row import would
 *     blow the Vercel `maxDuration` budget several times over, and
 *     the CSV macros are MFP's user-confirmed totals (the user already
 *     resolved any matching ambiguity in MFP). Background re-matching
 *     for low-confidence rows is a deferred follow-up — see the
 *     decision doc `docs/decisions/2026-05-02-mfp-csv-import.md`. If
 *     a future change adds the enrichment pass, the threshold should
 *     be ≥ `MFP_MATCH_CONFIDENCE_THRESHOLD` (0.7, exported from
 *     `@/lib/imports/mfpCsvLimits`) — anything softer risks silently
 *     overriding correct CSV values with weak fuzzy matches, which
 *     CLAUDE.md prohibits.
 *   - Hard cap at 1000 rows per request. Larger histories should be
 *     split into multiple uploads (UI handles this transparently).
 *   - Multipart form-data input — `<input type="file">` and
 *     `expo-document-picker` both submit this shape natively, no
 *     base64 round-trip.
 *   - Per-user rate limit 5 / day. Bulk imports are heavy on the
 *     downstream food-search APIs; this cap is well above any
 *     legitimate user need but cheap enough to defend against abuse.
 *   - Idempotent on retry via `(source, source_id)` partial unique
 *     index (added in 20260421200050_nutrition_entries_source_dedup):
 *     each row's `source_id` is `<userId>:<date>:<rowIndex>` so a
 *     re-uploaded file does not duplicate.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import {
  parseMfpCsv,
  mapMfpMealToSlot,
  type MfpCsvRow,
} from "@/lib/imports/mfpCsv";
import {
  MFP_IMPORT_BYTE_CAP,
  MFP_IMPORT_ROW_CAP,
} from "@/lib/imports/mfpCsvLimits";

export const runtime = "nodejs";

type EntryInsert = {
  user_id: string;
  date_key: string;
  name: string;
  recipe_title: string;
  time_label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  source_id: string;
  imported_at?: string;
  created_at?: string;
};

/**
 * Build a `nutrition_entries` insert payload from one CSV row. Returns
 * null if the row is missing the macros we treat as required for an
 * import (calories — the rest can default to 0 and still be useful).
 */
function rowToEntry(
  userId: string,
  row: MfpCsvRow,
  rowIndex: number,
): EntryInsert | null {
  // We require a date and name (parser already enforces) and a non-null
  // calories value. A row with `null` calories is effectively a stub
  // and would distort the day total without telling the user why.
  if (row.calories == null) return null;

  const slot = mapMfpMealToSlot(row.meal);
  const sourceId = `${userId}:${row.date}:${rowIndex}`;

  return {
    user_id: userId,
    date_key: row.date,
    // Match the convention from healthSync.ts: `name` is the slot,
    // `recipe_title` is the food line. This keeps day-grouping consistent
    // with manual + Apple Health imports.
    name: slot,
    recipe_title: row.name,
    time_label: "",
    calories: Math.round(row.calories),
    protein: row.protein ?? 0,
    carbs: row.carbs ?? 0,
    fat: row.fat ?? 0,
    source: "mfp_import",
    source_id: sourceId,
  };
}

export async function POST(req: Request) {
  // 1. Auth.
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // 2. Rate limit — 5 imports / day / user. Bulk imports are heavy.
  const rl = await rateLimit({
    keyPrefix: "api:imports:mfp-csv",
    userId,
    limit: 5,
    windowMs: 24 * 60 * 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "MFP imports are limited to 5 per day. Try again tomorrow.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  // 3. Parse multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Expected multipart/form-data with a 'file' field." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { ok: false, error: "missing_file", message: "Upload a .csv file under 'file'." },
      { status: 400 },
    );
  }

  // Guard size before reading into memory. `File.size` is exact for
  // browser/native uploads; we still cap the read defensively.
  if (file.size > MFP_IMPORT_BYTE_CAP) {
    return NextResponse.json(
      {
        ok: false,
        error: "file_too_large",
        message: `File exceeds ${Math.round(MFP_IMPORT_BYTE_CAP / 1024 / 1024)}MB. Split your export into smaller files.`,
      },
      { status: 413 },
    );
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: "read_failed", message: "Could not read the uploaded file." },
      { status: 400 },
    );
  }

  // 4. Parse CSV.
  const { rows, warnings } = parseMfpCsv(text);
  if (rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_rows",
        message:
          warnings.includes("missing_required_columns")
            ? "We couldn't find a Date/Food column. Re-export from MyFitnessPal with the standard CSV format."
            : "No usable rows in this CSV.",
        warnings,
      },
      { status: 422 },
    );
  }

  // 5. Cap at MFP_IMPORT_ROW_CAP. We don't 413 here — we accept the
  //    first N and tell the user the rest were skipped.
  const truncated = rows.length > MFP_IMPORT_ROW_CAP;
  const capped = truncated ? rows.slice(0, MFP_IMPORT_ROW_CAP) : rows;

  // 6. Map to insert payloads.
  const entries: EntryInsert[] = [];
  let unmatchedCount = 0;
  capped.forEach((row, i) => {
    const entry = rowToEntry(userId, row, i);
    if (!entry) {
      unmatchedCount++;
      return;
    }
    entries.push(entry);
  });

  // Sample is the first 5 mapped rows (post-CSV-parse, pre-insert) so
  // the UI can show a confidence-building preview.
  const sample = capped.slice(0, 5).map((r) => ({
    date: r.date,
    meal: mapMfpMealToSlot(r.meal),
    name: r.name,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
  }));

  if (entries.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_valid_rows",
        message: "Every row was missing a calories value. Check your MFP export.",
        warnings,
        sample,
      },
      { status: 422 },
    );
  }

  // 7. Insert. Use the service-role client because the JWT for
  //    `getUserIdFromRequest` doesn't authenticate the Postgres role
  //    we need for batched inserts; we already verified `userId`
  //    above so RLS is enforced in code, not in DB.
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "Import is temporarily unavailable." },
      { status: 503 },
    );
  }

  let imported = 0;
  for (let i = 0; i < entries.length; i += 50) {
    const batch = entries.slice(i, i + 50);
    const { error, data } = await supabase
      .from("nutrition_entries")
      .upsert(batch, { onConflict: "user_id,source,source_id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      // Fail loud on any insert error — partial imports without a clear
      // signal are worse than telling the user to retry.
      return NextResponse.json(
        {
          ok: false,
          error: "insert_failed",
          message: `Database error after ${imported} rows. Please retry.`,
          imported,
          warnings,
        },
        { status: 500 },
      );
    }
    imported += data?.length ?? 0;
  }

  return NextResponse.json({
    ok: true,
    imported,
    unmatched: unmatchedCount,
    truncated,
    sample,
    warnings,
  });
}
