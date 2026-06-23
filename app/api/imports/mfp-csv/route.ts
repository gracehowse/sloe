/**
 * POST /api/imports/mfp-csv — bulk import a CSV export from a supported
 * competitor app (MyFitnessPal, Lose It, Cronometer, …).
 *
 * Closes the MFP-refugee history-bridge gap (P1 customer-lens) and now
 * the broader competitor-refugee gap (ENG-37). The URL still says
 * `mfp-csv` for backwards compat with existing UI clients, but the
 * route auto-detects the source format from the header row and
 * dispatches to the right adapter under
 * `src/lib/imports/csv/adapters/`. Supported sources land in the DB
 * tagged with their adapter `source` so debugging + filtering can tell
 * them apart.
 *
 * Decisions:
 *   - Preview-first (ENG-1234). `?mode=preview` (the default, and what
 *     any caller that omits the param gets) parses the file and returns
 *     `{ source, total, unmatched, truncated, sample }` WITHOUT writing a
 *     single row. `?mode=commit` re-parses the same file and inserts. The
 *     two-phase flow is the MFP-refugee trust moment: the user sees their
 *     own data mapped correctly before anything lands. Re-parsing on
 *     commit (rather than trusting client-sent rows) keeps the server the
 *     sole authority over what enters the DB; the dedup index makes the
 *     extra round-trip idempotent. Only commits consume the rate limit.
 *   - Auto-detect via {@link parseCsvImport}. No `source` parameter on
 *     the request — the header row is the source of truth. If the file
 *     can't be auto-detected (header row matches no adapter), the
 *     response surfaces `unknown_source` with a hint to pick a known
 *     format.
 *   - Pure server-side parse + insert. We do not re-derive macros from
 *     ingredient strings — the CSV macros are the source app's
 *     pre-multiplied totals for the meal entry, so re-deriving would
 *     double-count (and most rows do not have a parseable ingredient
 *     list to begin with).
 *   - We DO NOT re-run name matching against USDA / OFF / FatSecret
 *     synchronously. Per-row enrichment for a 1k-row import would
 *     blow the Vercel `maxDuration` budget several times over, and
 *     the CSV macros are the source app's user-confirmed totals.
 *     ENG-750 rejects background re-matching for "low-confidence" rows:
 *     imports store no confidence score, and auto-swapping MFP-confirmed
 *     macros for fuzzy guesses would violate the nutrition trust bar.
 *     Any future enrichment must be user-initiated per entry, show
 *     candidates from the lightweight log-sheet matcher, and only apply
 *     after explicit confirmation; see
 *     `docs/decisions/2026-05-02-mfp-csv-import.md`.
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
 *     re-uploaded file does not duplicate. The `source` segment is
 *     `<adapter.source>_import` so MFP / Lose It / Cronometer rows
 *     never collide on dedup even when row indexes overlap.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import {
  getUserIdFromRequest,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/serverAnonClient";
import { parseCsvImport } from "@/lib/imports/csv/parseCsvImport";
import type { CanonicalImportRow } from "@/lib/imports/csv/types";
import {
  MFP_IMPORT_BYTE_CAP,
  MFP_IMPORT_ROW_CAP,
} from "@/lib/imports/mfpCsvLimits";
import { canonicalNutritionEntrySource } from "@/lib/nutrition/canonicalNutritionEntrySource";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";

/**
 * How many parsed rows the preview returns to the client. Big enough to
 * build trust that the right columns mapped (date / meal / food / macros)
 * across a few days, small enough to keep the payload tiny. The full
 * `total` count is returned separately so the client can render
 * "+N more". (ENG-1234)
 */
const PREVIEW_SAMPLE_SIZE = 8;

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
};

/**
 * Build a `nutrition_entries` insert payload from one canonical CSV
 * row. Returns null if the row is missing the macros we treat as
 * required for an import (calories — the rest can default to 0 and
 * still be useful).
 *
 * The `source` field on each insert is canonicalized via
 * {@link canonicalNutritionEntrySource} (ENG-674) — CSV imports land as
 * `"manual"` in the DB. The JSON response `source` field keeps the
 * adapter id (`mfp`, `lose-it`, `cronometer`) for UI/debugging.
 */
function rowToEntry(
  userId: string,
  row: CanonicalImportRow,
  rowIndex: number,
  adapterSource: string,
): EntryInsert | null {
  // We require a date and name (parser already enforces) and a non-null
  // calories value. A row with `null` calories is effectively a stub
  // and would distort the day total without telling the user why.
  if (row.calories == null) return null;

  // `slot` is the adapter's canonical mapping (one of breakfast / lunch
  // / dinner / snack), or `null` if the adapter couldn't decide. Default
  // to `snack` — least disruptive bucket — for ambiguous rows so they
  // don't disappear from the day view.
  const slot = row.slot ?? "snack";
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
    source: canonicalNutritionEntrySource(`${adapterSource}_import`) ?? "manual",
    source_id: sourceId,
  };
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  // 1. Auth.
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  // 2. Mode. `commit` inserts; anything else (including absent) is a
  //    fail-safe `preview` — parse + sample only, no DB write. The whole
  //    import contract is preview-first (ENG-1234): the client uploads
  //    once to preview the parsed sample, the user confirms what they're
  //    about to import, and only the explicit `commit` round-trip writes
  //    anything. A stale or malformed caller therefore can never insert
  //    by omission — the worst it can do is parse a file in memory.
  const mode =
    new URL(req.url).searchParams.get("mode") === "commit"
      ? "commit"
      : "preview";

  // 3. Rate limit — COMMITS only. A preview is an in-memory parse (auth +
  //    byte-cap bounded, no DB cost), so counting it against the 5/day
  //    insert budget would halve a user's real import allowance for no
  //    abuse benefit. The expensive, abusable op is the batched insert,
  //    and that is exactly what stays capped. (ENG-1234)
  if (mode === "commit") {
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
  }

  // 3. Parse multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_body",
        message: "Expected multipart/form-data with a 'file' field.",
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      {
        ok: false,
        error: "missing_file",
        message: "Upload a .csv file under 'file'.",
      },
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
      {
        ok: false,
        error: "read_failed",
        message: "Could not read the uploaded file.",
      },
      { status: 400 },
    );
  }

  // 4. Parse CSV with auto-detect. `parseCsvImport` sniffs the header
  //    row and dispatches to the right adapter (MFP, Lose It, Cronometer,
  //    …). `source` is `"unknown"` when no adapter recognised the file.
  const { source, rows, warnings } = parseCsvImport(text);
  if (source === "unknown") {
    return NextResponse.json(
      {
        ok: false,
        error: "unknown_source",
        message:
          "We couldn't identify this CSV's source format. Supported today: MyFitnessPal, Lose It, Cronometer. Re-export from a supported app or check the help docs.",
        warnings,
      },
      { status: 422 },
    );
  }
  if (rows.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "no_rows",
        message: warnings.includes("missing_required_columns")
          ? "We couldn't find a Date/Food column in this CSV. Re-export with the standard format."
          : "No usable rows in this CSV.",
        warnings,
        source,
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
    const entry = rowToEntry(userId, row, i, source);
    if (!entry) {
      unmatchedCount++;
      return;
    }
    entries.push(entry);
  });

  // Sample is the first N mapped rows (post-CSV-parse, pre-insert) so
  // the UI can show a confidence-building preview before the user commits.
  // The `meal` field is the canonical slot (or `snack` fallback for
  // adapter `null`).
  const sample = capped.slice(0, PREVIEW_SAMPLE_SIZE).map((r) => ({
    date: r.date,
    meal: r.slot ?? "snack",
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
        message: "Every row was missing a calories value. Check your CSV export.",
        warnings,
        sample,
        source,
      },
      { status: 422 },
    );
  }

  // Preview mode stops here — the file parsed cleanly, so hand the client
  // the source, the total importable count, the skipped count, and a
  // sample to render. NOTHING is written. The client shows this, the user
  // confirms, and the follow-up `?mode=commit` request (same file)
  // re-parses server-side and inserts. Re-parsing on commit keeps the
  // server the single source of truth for what lands in the DB — the
  // client never gets to hand us macros to insert — and the
  // `(user_id, source, source_id)` dedup index makes the round-trip
  // idempotent. (ENG-1234)
  if (mode === "preview") {
    return NextResponse.json({
      ok: true,
      mode: "preview",
      source,
      total: entries.length,
      unmatched: unmatchedCount,
      truncated,
      sample,
      warnings,
    });
  }

  // Insert (commit). Use the service-role client because the JWT for
  //    `getUserIdFromRequest` doesn't authenticate the Postgres role
  //    we need for batched inserts; we already verified `userId`
  //    above so RLS is enforced in code, not in DB.
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message: "Import is temporarily unavailable.",
      },
      { status: 503 },
    );
  }

  let imported = 0;
  for (let i = 0; i < entries.length; i += 50) {
    const batch = entries.slice(i, i + 50);
    const { error, data } = await supabase
      .from("nutrition_entries")
      .upsert(batch, {
        onConflict: "user_id,source,source_id",
        ignoreDuplicates: true,
      })
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
    mode: "commit",
    source,
    imported,
    unmatched: unmatchedCount,
    truncated,
    sample,
    warnings,
  });
}
