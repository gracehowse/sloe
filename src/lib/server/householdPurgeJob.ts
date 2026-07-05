/**
 * Server-side helpers for `POST /api/cron/household-purge` (ENG-1359).
 *
 * Background: the Netflix-model v1 disband flow (`households.disbanded_at`,
 * migration `20260501100010_households_disbanded_at.sql`) flags a household
 * as disbanded when its last member leaves, rather than deleting it
 * immediately — `household_meals` rows are referenced from other users'
 * meal-history / logging provenance, so an immediate hard-delete would
 * corrupt that history. The comment on that migration (and the
 * `leaveHousehold` call site in `src/lib/household/householdClient.ts`)
 * promised "a background job (not yet shipped) hard-deletes after 30
 * days" — that job never existed, so disbanded households and every row
 * that references them have been accumulating in production indefinitely.
 * This module is that job.
 *
 * Data model (verified against the live schema, 2026-07-05 — see
 * `information_schema` FK query in the ENG-1359 PR description):
 *   - `households.disbanded_at` — set (not null) when the household was
 *     flagged disbanded. NULL households are never touched.
 *   - `household_members.household_id` → households(id) ON DELETE CASCADE
 *   - `household_meals.household_id`   → households(id) ON DELETE CASCADE
 *   - `household_invites.household_id` → households(id) ON DELETE CASCADE
 *   - `shopping_items.household_id`    → households(id) ON DELETE CASCADE
 *   - `profiles.household_id`          → households(id) ON DELETE SET NULL
 *
 * Every dependent row is CASCADE (or SET NULL for `profiles`, which is
 * correct — we don't want to delete a *user's* profile because their old
 * household was purged). A single `DELETE FROM households WHERE id = ...`
 * therefore hard-deletes the household plus every cascading dependent row
 * at the database level — there is no separate application-level fan-out
 * needed and no way for this job itself to leave an orphan on the "other
 * tables still point at a deleted household" side. (If a future migration
 * adds a new `household_id` FK without an explicit `ON DELETE` action, the
 * default `NO ACTION` would make the parent `DELETE` fail loudly rather
 * than orphan silently — fail-safe by construction.)
 *
 * Idempotency: the job selects households by `disbanded_at <= cutoff`,
 * deletes them, and returns how many were deleted. A second immediate run
 * with no new eligible households is a 200 with `deletedCount: 0` — safe
 * to run repeatedly (retries, GH Actions re-runs, manual invocation).
 *
 * Auditability: logs one structured line (`at: "cron.household_purge"`)
 * per run with counts only — no household names, owner ids, or member
 * emails — matching the no-PII-in-logs bar used elsewhere (e.g.
 * `supabaseAdvisorCheck.ts`, weekly-recap route).
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Constant-time string compare to avoid timing attacks on the cron secret. */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Retention window before a disbanded household is eligible for hard-delete. */
export const HOUSEHOLD_PURGE_RETENTION_DAYS = 30;

interface PurgeSummary {
  ok: boolean;
  eligibleCount: number;
  deletedCount: number;
  cutoff: string;
  durationMs: number;
}

/**
 * Core purge logic, dependency-injected on the Supabase client + "now"
 * so tests can run without a live DB / real clock.
 *
 * Deliberately two-step (select ids, then delete by id list) rather than
 * a single `delete ... where disbanded_at <= cutoff`: it lets us report
 * an accurate `deletedCount` (PostgREST's `delete()` only returns rows
 * back if you ask for a `select()` on the response, which we do — but
 * selecting the ids first also means a concurrent write that flips
 * `disbanded_at` back to null between select and delete just narrows
 * what gets deleted, it can't widen it or throw).
 */
export async function runHouseholdPurge(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<PurgeSummary> {
  const t0 = Date.now();
  const cutoff = new Date(now.getTime() - HOUSEHOLD_PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString();

  const { data: eligible, error: selectErr } = await supabase
    .from("households")
    .select("id")
    .not("disbanded_at", "is", null)
    .lte("disbanded_at", cutoffIso);

  if (selectErr) {
    console.log(
      JSON.stringify({
        at: "cron.household_purge",
        phase: "select_failed",
        error: selectErr.message,
      }),
    );
    throw new Error(`household_purge select failed: ${selectErr.message}`);
  }

  const ids = (eligible ?? []).map((row: { id: string }) => row.id);

  if (ids.length === 0) {
    console.log(
      JSON.stringify({
        at: "cron.household_purge",
        phase: "complete",
        eligibleCount: 0,
        deletedCount: 0,
        cutoff: cutoffIso,
      }),
    );
    return {
      ok: true,
      eligibleCount: 0,
      deletedCount: 0,
      cutoff: cutoffIso,
      durationMs: Date.now() - t0,
    };
  }

  // Hard-delete. FK CASCADE on household_members / household_meals /
  // household_invites / shopping_items removes every dependent row in
  // the same transaction; profiles.household_id (ON DELETE SET NULL)
  // is cleared rather than deleted, which is correct — a user's own
  // profile must survive their old household being purged.
  const { data: deleted, error: deleteErr } = await supabase
    .from("households")
    .delete()
    .in("id", ids)
    .select("id");

  if (deleteErr) {
    console.log(
      JSON.stringify({
        at: "cron.household_purge",
        phase: "delete_failed",
        eligibleCount: ids.length,
        error: deleteErr.message,
      }),
    );
    throw new Error(`household_purge delete failed: ${deleteErr.message}`);
  }

  const deletedCount = (deleted ?? []).length;

  console.log(
    JSON.stringify({
      at: "cron.household_purge",
      phase: "complete",
      eligibleCount: ids.length,
      deletedCount,
      cutoff: cutoffIso,
    }),
  );

  return {
    ok: true,
    eligibleCount: ids.length,
    deletedCount,
    cutoff: cutoffIso,
    durationMs: Date.now() - t0,
  };
}

/**
 * Full HTTP handler logic (auth gate + admin client resolution + run),
 * dependency-injected so the route file stays a thin wrapper and tests
 * can drive it without HTTP or a live DB.
 */
export async function runHouseholdPurgeRoute(
  req: Request,
  getAdminClient: () => SupabaseClient | null,
  runner: typeof runHouseholdPurge = runHouseholdPurge,
): Promise<NextResponse> {
  // 1. Auth gate — shared-secret header (same convention as the other
  //    scheduled crons — see .github/workflows/scheduled-crons.yml).
  const expected = process.env.SUPPR_CRON_SECRET;
  if (!expected || expected.length === 0) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "SUPPR_CRON_SECRET unset" },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!safeCompare(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2. Service-role client — hard-delete must bypass RLS (disbanded
  //    households have no members left, so RLS would otherwise hide
  //    them from every possible caller, including this job).
  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message: "SUPABASE_SERVICE_ROLE_KEY unset",
      },
      { status: 503 },
    );
  }

  try {
    const summary = await runner(supabase);
    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "purge_failed",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
