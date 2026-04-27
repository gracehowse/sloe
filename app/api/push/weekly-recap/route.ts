/**
 * POST /api/push/weekly-recap
 *
 * Server-side fan-out of the weekly recap push (TestFlight build 10
 * fix C — `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`
 * follow-up to the 2026-04-18 token-capture shipment).
 *
 * Sunday push rewrite — T3/T4/T6 (2026-04-19):
 *   - T3: per-user nutrition data fetch (`nutrition_entries` for the
 *     previous week + extended `profiles` columns) so the body can be
 *     content-specific instead of one generic line.
 *   - T4: composed body = `{cascade headline} · {recap sentence}`
 *     when `selectDigestSuggestion(...)` returns non-null; falls
 *     through to the existing 3-variant formatter otherwise.
 *   - T6: server-side `weekly_recap_push_sent` analytics emit per
 *     successful push, with `{ userId, weekKey, bodyVariant,
 *     suggestionRule }` so the open-rate funnel has a real
 *     denominator.
 *
 * Invocation chain:
 *   Vercel cron → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *                 → service-role select of opted-in profiles with a token
 *                 → dedupe filter (skip rows pushed in last 6 days)
 *                 → IN(...) select on `nutrition_entries` for eligible users
 *                 → per-user `buildWeeklyRecap` + `selectDigestSuggestion`
 *                 → `formatWeeklyRecapPushBody(recap, suggestion)`
 *                 → `sendExpoPush` → Expo → APNs → devices
 *                 → post-send writes `last_weekly_recap_push_sent_at`,
 *                   nulls `expo_push_token` for `DeviceNotRegistered` rows,
 *                   and emits `weekly_recap_push_sent` per success.
 *
 * Guardrails:
 *   - Auth is a shared-secret header, not a user JWT.
 *   - Per-user dedupe via `last_weekly_recap_push_sent_at` (skip rows
 *     pushed in the last 6 days). The dedupe filter runs BEFORE the
 *     nutrition_entries fetch so we don't waste compute on users we'll
 *     skip anyway.
 *   - Hard cap of 5000 rows per invocation.
 *   - Helper (`src/lib/push/expoPush.ts`) is the only file that knows
 *     about the Expo push API.
 *   - Per-user compute failure is silently skipped (the user gets no
 *     push this week, the next cron retries) and the failure is logged
 *     with structured `{ at, phase: "recap_failed", userId, error }`.
 *     We deliberately do NOT fall back to the generic body — a generic
 *     body next to a failed compute would mask a real bug. Future
 *     engineers: this is intentional; see Sunday push rewrite T3 spec.
 *
 * Live-DB dependency: the route assumes the A2 schema migration
 * (`20260427110000_profiles_target_calories_provenance.sql`) has been
 * applied. The select includes `target_calories_set_at` /
 * `target_calories_source` columns. Without the migration the select
 * will throw at runtime. There is no defensive fallback by design.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { sendExpoPush, type ExpoPushMessage } from "@/lib/push/expoPush";
import { sendWebPushFanout } from "@/lib/push/webPushSend";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import { buildWeeklyRecap, weekKeyFor } from "@/lib/nutrition/weeklyRecap";
import { buildWeekStats } from "@/lib/nutrition/progressWeekReport";
import { resolveMaintenance } from "@/lib/nutrition/resolveMaintenance";
import { formatWeeklyRecapPushBody } from "@/lib/nutrition/weeklyRecapPushBody";
import {
  selectDigestSuggestion,
  type DigestSuggestionProfile,
} from "@/lib/nutrition/weeklyDigestSuggestion";
import {
  entriesToByDay,
  entriesToFiberByDay,
  parseFreezeLedger,
  parseHydrationByDay,
  parseWeightKgByDay,
  previousWeekDescriptor,
  type NutritionEntryRow,
} from "@/lib/push/weeklyRecapPayload";
import { shouldPushWeeklyRecapNow } from "@/lib/push/weeklyRecapTzFilter";
import { availableFreezes } from "@/lib/nutrition/streakFreeze";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { serverTrack } from "@/lib/analytics/serverTrack";

/** Maximum rows this route will fan out to per invocation. */
const MAX_ROWS_PER_INVOCATION = 5000;

/** Dedupe window — skip rows pushed more recently than this. */
const DEDUPE_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

/**
 * Constant-time string comparison for the cron shared secret. Using `===`
 * leaks secret length + prefix via timing — `timingSafeEqual` requires
 * equal-length buffers so we short-circuit the length check first without
 * branching on byte content.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Default daily target fallbacks when a profile has no per-macro target.
 *  Mirrors the resolver-side defaults — kept here as a local constant so
 *  the recap math always has positive divisors (the formatter divides
 *  by `targets.protein` for the protein-adherence pct). When all four
 *  targets are missing the recap reports `proteinAdherencePct: 0`,
 *  which is the honest "no target on file" signal. */
const TARGET_FALLBACK = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
} as const;

type ProfileRow = {
  id: string;
  expo_push_token: string | null;
  last_weekly_recap_push_sent_at: string | null;
  week_start_day?: string | null;
  tz_iana?: string | null;

  // Recap inputs
  weight_kg_by_day?: unknown;
  target_calories?: number | null;
  target_protein?: number | null;
  target_carbs?: number | null;
  target_fat?: number | null;
  /** B1 (2026-04-27) — fibre + hydration adherence inputs. Null means
   *  no target on file; the recap suppresses the corresponding line.
   *  `target_water_ml` is the canonical hydration column — see the
   *  tombstone in 20260503104000_profiles_fiber_hydration_targets.sql
   *  for the audit trail. */
  target_fiber_g?: number | null;
  target_water_ml?: number | null;
  /** B1 — JSONB { "YYYY-MM-DD": ml } from F-13 hydration chip persists. */
  extra_water_by_day?: unknown;
  streak_freeze_budget_max?: number | null;
  streak_freezes_earned_at?: unknown;
  streak_freezes_used_history?: unknown;

  // Cascade inputs
  target_calories_set_at?: string | null;
  target_calories_source?: string | null;
  goal?: string | null;
  goal_weight_kg?: number | null;

  // Maintenance resolver inputs
  adaptive_tdee?: number | null;
  adaptive_tdee_confidence?: string | null;
  adaptive_tdee_updated_at?: string | null;
  sex?: string | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  age?: number | null;
  activity_level?: string | null;
};

/** Columns the server-side `select` pulls. Centralised so the test
 *  fixture and the runtime call cannot drift. */
const PROFILE_SELECT_COLUMNS = [
  "id",
  "expo_push_token",
  "last_weekly_recap_push_sent_at",
  "week_start_day",
  "tz_iana",
  "weight_kg_by_day",
  "target_calories",
  "target_protein",
  "target_carbs",
  "target_fat",
  // B1 (2026-04-27) — fibre + hydration columns. Both already live in
  // production: `target_fiber_g` since 2026-04-12 (default 25);
  // `target_water_ml` is the canonical hydration target column. The
  // 20260503104000 migration was retired to a tombstone after audit;
  // no ALTER TABLE was needed.
  "target_fiber_g",
  "target_water_ml",
  "extra_water_by_day",
  "streak_freeze_budget_max",
  "streak_freezes_earned_at",
  "streak_freezes_used_history",
  "target_calories_set_at",
  "target_calories_source",
  "goal",
  "goal_weight_kg",
  "adaptive_tdee",
  "adaptive_tdee_confidence",
  "adaptive_tdee_updated_at",
  "sex",
  "weight_kg",
  "height_cm",
  "age",
  "activity_level",
].join(", ");

export async function POST(req: Request) {
  // 1. Auth gate — shared-secret header.
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

  // 2. Timezone-aware fan-out (T12, 2026-04-20): the cron now fires
  //    hourly from vercel.json. Each invocation we filter eligible
  //    users to those whose current local time is 18:00 on their
  //    end-of-week day (Sunday for monday-start users, Saturday for
  //    sunday-start users). Filter runs in-memory after the DB
  //    select because tz math requires Intl and isn't expressible as
  //    a SQL predicate. The dedupe window (6 days) prevents
  //    double-fires across the hourly cron.
  const supabase = getSupabaseAdminClient();
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

  // 3. Select profiles. The full column list is required because the
  //    recap + cascade run server-side now (T3/T4) — we can't do per-
  //    user fetches in a follow-up RTT without ballooning latency.
  const query = supabase
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .eq("weekly_recap_push_enabled", true)
    .not("expo_push_token", "is", null);

  const { data: rows, error: selectErr } = await query.range(
    0,
    MAX_ROWS_PER_INVOCATION - 1,
  );
  if (selectErr) {
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        phase: "select_failed",
        error: selectErr.message,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "select_failed", message: selectErr.message },
      { status: 500 },
    );
  }

  // 4. Dedupe + tz filter BEFORE the nutrition_entries fetch — there
  //    is no point in pulling 7 days of meal rows for users we won't
  //    push to. Dedupe comes from T3 (2026-04-19); tz filter is T12
  //    (2026-04-20). Evaluation order doesn't matter for correctness
  //    since both are user-scoped predicates.
  const now = Date.now();
  const nowUtc = new Date(now);
  // Cast through `unknown` because supabase-js infers
  // `GenericStringError[]` for the long, comma-joined column list and
  // refuses the direct cast. Runtime shape is the row shape.
  const eligible = ((rows ?? []) as unknown as ProfileRow[]).filter((r) => {
    if (!r.expo_push_token) return false;
    // Dedupe: skip if pushed within the last 6 days.
    if (r.last_weekly_recap_push_sent_at) {
      const lastSentMs = Date.parse(r.last_weekly_recap_push_sent_at);
      if (Number.isFinite(lastSentMs) && now - lastSentMs < DEDUPE_WINDOW_MS) {
        return false;
      }
    }
    // Tz filter: fire only when it's 18:00 local on the user's
    // end-of-week day. Null tz → treated as UTC (preserves
    // pre-migration behaviour).
    const wsd: "monday" | "sunday" =
      r.week_start_day === "sunday" ? "sunday" : "monday";
    return shouldPushWeeklyRecapNow({ tzIana: r.tz_iana ?? null, weekStartDay: wsd }, nowUtc);
  });

  const attempted = eligible.length;
  if (attempted === 0) {
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        attempted: 0,
        succeeded: 0,
        deregistered: 0,
      }),
    );
    return NextResponse.json({ ok: true, attempted: 0, succeeded: 0, deregistered: 0 });
  }

  // 5. Fetch nutrition_entries for the union of all eligible users
  //    over the previous-week window. One IN(...) query, indexed by
  //    `(user_id, date_key)` (idx_ne_user_date from the original
  //    relational migration). The window is the smallest superset of
  //    all per-user previous-week ranges — Monday-start and Sunday-
  //    start cohorts can shift by a day, so we widen by one day on
  //    each end. The per-user reshape filters by exact week keys
  //    later in `entriesToByDay`.
  const nowDate = new Date(now);
  const widestStart = new Date(nowDate);
  widestStart.setDate(widestStart.getDate() - 14);
  const widestStartKey = dateKey(widestStart);
  const widestEndKey = dateKey(nowDate);

  const eligibleUserIds = eligible.map((r) => r.id);
  const { data: entryRows, error: entriesErr } = await supabase
    .from("nutrition_entries")
    .select("user_id, date_key, name, recipe_title, calories, protein, carbs, fat, fiber_g")
    .in("user_id", eligibleUserIds)
    .gte("date_key", widestStartKey)
    .lte("date_key", widestEndKey);
  if (entriesErr) {
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        phase: "entries_select_failed",
        error: entriesErr.message,
      }),
    );
    return NextResponse.json(
      {
        ok: false,
        error: "entries_select_failed",
        message: entriesErr.message,
      },
      { status: 500 },
    );
  }

  // Group rows by user once, so the per-user loop is O(N) over its
  // own rows instead of O(allRows).
  const rowsByUser = new Map<string, NutritionEntryRow[]>();
  for (const row of (entryRows ?? []) as NutritionEntryRow[]) {
    const list = rowsByUser.get(row.user_id);
    if (list) list.push(row);
    else rowsByUser.set(row.user_id, [row]);
  }

  // 6. Per-user `saves` count — one query, IN(...), grouped client-
  //    side. Used by the cascade Rule 1 path (`saves.count` and
  //    `recentlyAddedCount`). PostgREST has no native group-by here,
  //    so we just fetch (user_id, created_at) tuples and bucket.
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const savesByUser = new Map<string, { count: number; recentlyAddedCount: number }>();
  const { data: savesRows, error: savesErr } = await supabase
    .from("saves")
    .select("user_id, created_at")
    .in("user_id", eligibleUserIds);
  if (savesErr) {
    // Saves are non-critical — the cascade Rule 1 just won't fire for
    // these users this week. Log + continue rather than abort the
    // whole cron.
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        phase: "saves_select_failed_continuing",
        error: savesErr.message,
      }),
    );
  } else {
    for (const s of (savesRows ?? []) as { user_id: string; created_at: string }[]) {
      const cur = savesByUser.get(s.user_id) ?? { count: 0, recentlyAddedCount: 0 };
      cur.count += 1;
      if (s.created_at && s.created_at >= sevenDaysAgo) cur.recentlyAddedCount += 1;
      savesByUser.set(s.user_id, cur);
    }
  }

  // 7. Compose per-user message. Per-user compute failure → silent
  //    skip + structured log. Do NOT fall back to the generic body —
  //    that would mask a real bug. (Sunday push rewrite — T3, 2026-04-19.)
  type Composed = {
    row: ProfileRow;
    message: ExpoPushMessage;
    weekKey: string;
    bodyVariant: string;
    suggestionRule: string | null;
  };
  const composed: Composed[] = [];
  for (const row of eligible) {
    try {
      const wsd: "monday" | "sunday" = row.week_start_day === "sunday" ? "sunday" : "monday";
      const descriptor = previousWeekDescriptor(wsd, nowDate);

      const targets = {
        calories: numOr(row.target_calories, TARGET_FALLBACK.calories),
        protein: numOr(row.target_protein, TARGET_FALLBACK.protein),
        carbs: numOr(row.target_carbs, TARGET_FALLBACK.carbs),
        fat: numOr(row.target_fat, TARGET_FALLBACK.fat),
        // B1 (2026-04-27) — fibre + hydration. 0 means "not on file";
        // builder + formatter both interpret 0 as suppression rather
        // than rendering "0%". Hydration plumbs from `target_water_ml`
        // (existing column) into the in-memory `targets.hydrationMl`
        // shape — semantic clarity in code, no schema duplication.
        fiber: numOr(row.target_fiber_g, 0),
        hydrationMl: numOr(row.target_water_ml, 0),
      };

      const userRows = rowsByUser.get(row.id) ?? [];

      // Optimisation — short-circuit users with zero entries this
      // week. Skip the recap math; the formatter returns the
      // zero-days variant from a synthetic recap stub. Mirror what
      // `buildWeeklyRecap` would produce for an empty `byDay`, just
      // without paying the streak/weight/best-day cost.
      const hasAnyEntryInWindow = userRows.some((r) =>
        descriptor.keys.includes(r.date_key),
      );

      const ledger = parseFreezeLedger(
        row.streak_freezes_earned_at,
        row.streak_freezes_used_history,
      );
      const budgetMax = numOr(row.streak_freeze_budget_max, 3);
      const freezesAvail = availableFreezes(ledger, budgetMax);

      let bodyOut: { body: string; variant: string };
      let suggestionRule: string | null = null;

      if (!hasAnyEntryInWindow) {
        // Skip heavy compute and use the formatter's zero_days path
        // directly. The synthetic recap mirrors what buildWeeklyRecap
        // would have returned for a 0-day week, but built without
        // running buildWeekStats.
        bodyOut = formatWeeklyRecapPushBody({
          weekKey: descriptor.weekKey,
          weekLabel: "",
          daysLogged: 0,
          avgCalories: 0,
          avgProtein: 0,
          proteinAdherencePct: 0,
          streakLength: 0,
          freezesAvailable: freezesAvail,
          bestDay: null,
          weightDeltaKg: null,
          weightFirstKg: null,
          weightLastKg: null,
          // B1 (2026-04-27) — zero-entry users get suppressed
          // fibre/hydration lines for free; rollup math runs on the
          // full builder path below for active users.
          avgFiberG: 0,
          fiberAdherencePct: 0,
          avgHydrationMl: 0,
          hydrationDaysOnTarget: 0,
        });
      } else {
        const byDay = entriesToByDay(userRows, row.id, descriptor.keys);
        const weightKgByDay = parseWeightKgByDay(row.weight_kg_by_day);
        // B1 (2026-04-27) — fibre + hydration adherence inputs.
        const fiberByDay = entriesToFiberByDay(userRows, row.id, descriptor.keys);
        const hydrationByDay = parseHydrationByDay(row.extra_water_by_day);

        const recap = buildWeeklyRecap({
          byDay,
          weightKgByDay,
          targets,
          weekStartDay: wsd,
          ledger,
          budgetMax,
          fiberByDay,
          hydrationByDay,
          now: nowDate,
        });

        // Cascade Rule 3 (`protein_nudge`) needs `proteinOnTarget` —
        // the count of days that hit ≥90% of the protein target.
        // `buildWeeklyRecap` does NOT expose this on the recap
        // (it's a cascade-only signal), so re-run `buildWeekStats`
        // anchored on the same previous-week date the recap snapped
        // to. Repeating the bucket walk costs O(7) per user and
        // keeps the cascade input honest — passing `0` here would
        // make Rule 3 fire for every user with ≥4 logged days.
        const previousWeekAnchor = new Date(nowDate);
        previousWeekAnchor.setDate(previousWeekAnchor.getDate() - 7);
        const weekBundle = buildWeekStats(
          byDay,
          targets,
          wsd,
          previousWeekAnchor,
        );

        // Cascade — gather inputs and run.
        const resolved = resolveMaintenance(
          {
            adaptive_tdee: row.adaptive_tdee ?? null,
            adaptive_tdee_confidence: row.adaptive_tdee_confidence ?? null,
            adaptive_tdee_updated_at: row.adaptive_tdee_updated_at ?? null,
            sex: row.sex as never,
            weight_kg: row.weight_kg ?? null,
            height_cm: row.height_cm ?? null,
            age: row.age ?? null,
            activity_level: row.activity_level as never,
          },
          { now: nowDate },
        );
        const cascadeProfile: DigestSuggestionProfile = {
          targetCaloriesSource:
            row.target_calories_source === "onboarding" ||
            row.target_calories_source === "user" ||
            row.target_calories_source === "recompute" ||
            row.target_calories_source === "digest_recalibration"
              ? row.target_calories_source
              : null,
          targetCaloriesSetAt: row.target_calories_set_at ?? null,
          goal:
            row.goal === "cut" || row.goal === "maintain" || row.goal === "bulk"
              ? row.goal
              : null,
          weightGoalKg: numOrNull(row.goal_weight_kg),
        };
        const saves = savesByUser.get(row.id) ?? { count: 0, recentlyAddedCount: 0 };

        // Cascade Rule 1 (`re_log_prompt`) needs `usualMealInsight`
        // and `saveSeedItemCount`. These are derived in the existing
        // Progress UI from a 14-day extended window + the user's
        // saved-meals list — neither of which the cron has fast
        // access to here. The route therefore passes `null` for the
        // insight and `0` for the seed count, which means Rule 1 is
        // structurally suppressed in v1 of the server-fanout path.
        // Rules 2–5 still fire normally; the worst-case slip is a
        // user who would have hit Rule 1 instead lands on Rule 2/3/
        // 4/5 or the unsuggested recap variant. Acceptable for v1.
        // Promoting Rule 1 would require fetching `saved_meals`
        // here — ticket noted in the docs follow-up.
        const suggestion = selectDigestSuggestion({
          recap,
          proteinOnTarget: weekBundle.proteinOnTarget,
          targets: { calories: targets.calories, protein: targets.protein },
          resolvedMaintenance: resolved,
          staticTdee: resolved?.formulaKcal ?? null,
          ledger,
          freezesAvailable: freezesAvail,
          saves,
          usualMealInsight: null,
          saveSeedItemCount: 0,
          profile: cascadeProfile,
          now: nowDate,
        });
        suggestionRule = suggestion?.rule ?? null;

        bodyOut = formatWeeklyRecapPushBody(recap, suggestion);
      }

      composed.push({
        row,
        weekKey: descriptor.weekKey,
        bodyVariant: bodyOut.variant,
        suggestionRule,
        message: {
          to: row.expo_push_token as string,
          title: "Your week in Suppr",
          body: bodyOut.body,
          // T5: weekKey + T4: bodyVariant in the data payload so the
          // open-listener can attribute opens to body variants in
          // analytics later.
          data: {
            deepLink: "/progress",
            kind: "weekly_recap",
            weekKey: descriptor.weekKey,
            bodyVariant: bodyOut.variant,
          },
          sound: "default",
          priority: "high",
        },
      });
    } catch (err) {
      // Per-user compute failure: silent skip + structured log. Do NOT
      // fall back to the generic body. The next cron retries.
      console.log(
        JSON.stringify({
          at: "push.weekly_recap",
          phase: "recap_failed",
          userId: row.id,
          error: (err as Error)?.message ?? "unknown",
        }),
      );
    }
  }

  if (composed.length === 0) {
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        attempted,
        succeeded: 0,
        deregistered: 0,
        skippedAllForCompute: true,
      }),
    );
    return NextResponse.json({
      ok: true,
      attempted,
      succeeded: 0,
      deregistered: 0,
    });
  }

  const messages = composed.map((c) => c.message);
  const result = await sendExpoPush(messages);

  if (!result.ok) {
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        phase: "send_failed",
        attempted,
        error: result.error,
        statusCode: result.statusCode,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "send_failed", message: result.error, statusCode: result.statusCode },
      { status: 502 },
    );
  }

  // 8. Post-send bookkeeping. For every successful ticket, stamp
  //    `last_weekly_recap_push_sent_at` and emit
  //    `weekly_recap_push_sent` (T6). For every DeviceNotRegistered
  //    ticket, null the token so we stop pushing to a dead install.
  const deregisteredSet = new Set(result.deregisteredTokens);
  const succeededUserIds: string[] = [];
  const deregisteredUserIds: string[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const ticket = result.tickets[i];
    const c = composed[i];
    if (!ticket || !c) continue;

    if (deregisteredSet.has(messages[i].to)) {
      deregisteredUserIds.push(c.row.id);
      continue;
    }
    if (ticket.status === "ok") {
      succeededUserIds.push(c.row.id);
      // T6 — fire-and-forget per-user analytics. The variant comes
      // straight off the formatter's return so the dashboard slice
      // and the rendered body cannot disagree. `weekKey` is the
      // recap window's key (NOT `currentWeekKey`), so the join
      // against `weekly_recap_push_opened` lines up cleanly.
      void serverTrack(AnalyticsEvents.weekly_recap_push_sent, c.row.id, {
        weekKey: c.weekKey,
        bodyVariant: c.bodyVariant,
        suggestionRule: c.suggestionRule,
      });
    }
    // Tickets with other `status: "error"` (e.g. MessageTooBig) are
    // intentionally not stamped — the next cron run retries them.
  }

  const nowIso = new Date(now).toISOString();

  if (succeededUserIds.length > 0) {
    const { error: stampErr } = await supabase
      .from("profiles")
      .update({ last_weekly_recap_push_sent_at: nowIso })
      .in("id", succeededUserIds);
    if (stampErr) {
      console.log(
        JSON.stringify({
          at: "push.weekly_recap",
          phase: "stamp_failed",
          count: succeededUserIds.length,
          error: stampErr.message,
        }),
      );
    }
  }

  if (deregisteredUserIds.length > 0) {
    const { error: clearErr } = await supabase
      .from("profiles")
      .update({ expo_push_token: null })
      .in("id", deregisteredUserIds);
    if (clearErr) {
      console.log(
        JSON.stringify({
          at: "push.weekly_recap",
          phase: "deregister_failed",
          count: deregisteredUserIds.length,
          error: clearErr.message,
        }),
      );
    }
  }

  // Web-push fan-out. Best-effort: iterates the same `composed` set and
  // sends the identical title/body to every web subscription the user
  // has. Web-only users (no expo_push_token) aren't in `composed` —
  // the select filter above requires a mobile token — so the first
  // iteration still misses them. Tracked TODO: broaden eligibility to
  // users with web subs but no expo token (follow-up).
  //
  // VAPID not configured → `sendWebPush` short-circuits; we still log
  // the phase so Grace can verify the cron loop once keys are set.
  let webSent = 0;
  let webDeadCount = 0;
  let webFailed = 0;
  let webVapidUnset = false;
  if (composed.length > 0) {
    const composedUserIds = composed.map((c) => c.row.id);
    const { data: webSubRows, error: webSelErr } = await supabase
      .from("web_push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", composedUserIds);
    if (webSelErr) {
      console.log(
        JSON.stringify({
          at: "push.weekly_recap",
          phase: "web_select_failed",
          error: webSelErr.message,
        }),
      );
    } else if (webSubRows && webSubRows.length > 0) {
      const byUser = new Map<
        string,
        Array<{ endpoint: string; p256dh: string; auth: string }>
      >();
      for (const row of webSubRows) {
        const list = byUser.get(row.user_id as string) ?? [];
        list.push({
          endpoint: row.endpoint as string,
          p256dh: row.p256dh as string,
          auth: row.auth as string,
        });
        byUser.set(row.user_id as string, list);
      }
      const deadEndpoints: string[] = [];
      for (const c of composed) {
        const subs = byUser.get(c.row.id);
        if (!subs || subs.length === 0) continue;
        const res = await sendWebPushFanout(subs, {
          title: c.message.title ?? "Your week in Suppr",
          body: c.message.body ?? "",
          url: "/home?view=progress",
          tag: `weekly_recap:${c.weekKey}`,
        });
        webSent += res.sent;
        webFailed += res.failed;
        if (res.vapidUnset) {
          webVapidUnset = true;
          break;
        }
        if (res.dead.length > 0) {
          deadEndpoints.push(...res.dead);
        }
      }
      if (deadEndpoints.length > 0) {
        webDeadCount = deadEndpoints.length;
        const { error: webDelErr } = await supabase
          .from("web_push_subscriptions")
          .delete()
          .in("endpoint", deadEndpoints);
        if (webDelErr) {
          console.log(
            JSON.stringify({
              at: "push.weekly_recap",
              phase: "web_delete_failed",
              count: deadEndpoints.length,
              error: webDelErr.message,
            }),
          );
        }
      }
    }
  }

  console.log(
    JSON.stringify({
      at: "push.weekly_recap",
      attempted,
      succeeded: succeededUserIds.length,
      deregistered: deregisteredUserIds.length,
      invalidTokens: result.invalidTokens.length,
      webSent,
      webDead: webDeadCount,
      webFailed,
      webVapidUnset,
    }),
  );

  return NextResponse.json({
    ok: true,
    attempted,
    succeeded: succeededUserIds.length,
    deregistered: deregisteredUserIds.length,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────────

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function numOr(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

