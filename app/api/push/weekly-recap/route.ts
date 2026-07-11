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
 * ENG-748 #7 (2026-05-27) — dual-rail fan-out. The route used to select
 * only profiles with a non-null `expo_push_token`, so browser-only
 * subscribers (Web Push, no app install) never received the recap. The
 * select now pulls every opted-in profile; the delivery rail is chosen
 * per-user after cross-referencing `web_push_subscriptions`. Mobile
 * tokens → Expo; browser subscriptions → Web Push (VAPID). A user with
 * both rails gets both and is stamped once.
 *
 * Invocation chain:
 *   GitHub Actions cron (.github/workflows/scheduled-crons.yml) → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *                 → service-role select of ALL opted-in profiles
 *                 → dedupe filter (skip rows pushed in last 6 days) + tz
 *                 → cross-reference `web_push_subscriptions` (step 4a),
 *                   drop candidates with neither rail (step 4b)
 *                 → IN(...) select on `nutrition_entries` for eligible users
 *                 → per-user `buildWeeklyRecap` + `selectDigestSuggestion`
 *                 → `formatWeeklyRecapPushBody(recap, suggestion)`
 *                 → mobile: `sendExpoPush` → Expo → APNs → devices
 *                 → web:    `sendWebPushFanout` → web-push → browsers
 *                 → post-send writes `last_weekly_recap_push_sent_at` for
 *                   every user delivered on either rail, nulls
 *                   `expo_push_token` for `DeviceNotRegistered` rows,
 *                   deletes dead web-push endpoints, and emits
 *                   `weekly_recap_push_sent` per success.
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
import * as Sentry from "@sentry/nextjs";
import { timingSafeEqual } from "crypto";

import { sendExpoPush, type ExpoPushMessage } from "@/lib/push/expoPush";
import { sendWebPushFanout } from "@/lib/push/webPushSend";
// ENG-717 — local-calendar date key, shared with mobile + the rest of web.
import { dateKeyFromDate as dateKey } from "@/lib/datetime/dateKey";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import { buildWeeklyRecap } from "@/lib/nutrition/weeklyRecap";
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
import { captureRouteError } from "@/lib/observability/captureRouteError";

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

/**
 * Sentry Cron monitor (2026-05-15) — wraps `runWeeklyRecapPush` so Sentry
 * gets a start check-in on every invocation and an OK/error check-in on
 * resolve. A missed run (Vercel cron didn't fire) shows up in Sentry's
 * Crons dashboard within `checkinMargin` minutes of the scheduled time.
 * The monitor auto-provisions on first check-in using the inline
 * `MonitorConfig`; no UI setup required. Schedule must match `vercel.json`
 * — if you change one, change both.
 */
const WEEKLY_RECAP_MONITOR_CONFIG = {
  schedule: { type: "crontab" as const, value: "0 23 * * *" },
  checkinMargin: 5,
  maxRuntime: 10,
  timezone: "UTC" as const,
};

export async function POST(req: Request) {
  return Sentry.withMonitor(
    "weekly-recap-push",
    () => runWeeklyRecapPush(req),
    WEEKLY_RECAP_MONITOR_CONFIG,
  );
}

async function runWeeklyRecapPush(req: Request) {
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
  //
  //    ENG-748 #7 (2026-05-27): we no longer filter on a non-null
  //    `expo_push_token` at the DB layer. Web-only subscribers (browser
  //    Web Push subscription, no Expo token) opt in via the SAME
  //    `weekly_recap_push_enabled` flag but were previously excluded
  //    here, so they never received the recap. We now pull every
  //    opted-in profile and decide per-user which rail(s) to dispatch
  //    over (Expo for mobile tokens, Web Push for browser subs) after
  //    cross-referencing `web_push_subscriptions`. Users with neither
  //    rail are dropped before any compute (step 4b).
  const query = supabase
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .eq("weekly_recap_push_enabled", true);

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
  //
  // ENG-748 #7: the rail filter (expo token OR web sub) moved DOWN to
  // step 4b — here we only apply the rail-agnostic predicates (dedupe +
  // tz). A web-only user has no `expo_push_token` but is still a
  // candidate; we discover their web subscription in 4a.
  const candidates = ((rows ?? []) as unknown as ProfileRow[]).filter((r) => {
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

  // 4a. Cross-reference web subscriptions for the candidate set. One
  //     IN(...) select, grouped client-side by user. We fetch this
  //     BEFORE composing so we can (a) keep web-only candidates in the
  //     eligible set and (b) drop candidates with NO rail at all without
  //     paying for their recap compute. Web-sub fetch failure is
  //     non-fatal — we log + continue with mobile-only fan-out so a flaky
  //     web_push_subscriptions read never blocks the (larger) mobile
  //     cohort.
  type WebSub = { endpoint: string; p256dh: string; auth: string };
  const webSubsByUser = new Map<string, WebSub[]>();
  if (candidates.length > 0) {
    const candidateIds = candidates.map((r) => r.id);
    const { data: webSubRows, error: webSelErr } = await supabase
      .from("web_push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", candidateIds);
    if (webSelErr) {
      console.log(
        JSON.stringify({
          at: "push.weekly_recap",
          phase: "web_select_failed",
          error: webSelErr.message,
        }),
      );
    } else {
      for (const row of (webSubRows ?? []) as Array<{
        user_id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }>) {
        const list = webSubsByUser.get(row.user_id) ?? [];
        list.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
        webSubsByUser.set(row.user_id, list);
      }
    }
  }

  // 4b. Rail filter — a candidate is eligible only if it has at least
  //     one delivery rail: a mobile Expo token OR a browser Web Push
  //     subscription. Users opted in via the flag but with neither rail
  //     (e.g. revoked browser permission AND no app install) are dropped
  //     here before any per-user compute.
  const eligible = candidates.filter(
    (r) => Boolean(r.expo_push_token) || (webSubsByUser.get(r.id)?.length ?? 0) > 0,
  );

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
  //
  //    ENG-748 #7: `message` is now nullable — web-only users (no Expo
  //    token) get a `null` Expo message and are dispatched over Web Push
  //    only. `title`/`body` are hoisted onto the composed record so the
  //    web-push fan-out reuses the exact same copy without reaching into
  //    a possibly-null Expo message.
  const RECAP_TITLE = "Your week in Sloe";
  type Composed = {
    row: ProfileRow;
    message: ExpoPushMessage | null;
    title: string;
    body: string;
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
          weekDayKeys: descriptor.keys,
          loggedDayKeys: [],
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

        // Cascade — gather inputs and run. This stays the LEGACY input
        // assembly: `energy_numbers_v1` is a client-side flag this server
        // route cannot read, and while the flag is default-OFF the push
        // copy must name the same maintenance the in-app flag-OFF surfaces
        // display (ENG-1506 review round, 2026-07-11).
        // deferred to flag-collapse: see ENG-1506 review — migrate to
        // buildMaintenanceInputs when energy_numbers_v1 ramps.
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
        title: RECAP_TITLE,
        body: bodyOut.body,
        // ENG-748 #7: only token-holders get an Expo message. Web-only
        // users carry `message: null` and are reached via Web Push below.
        message: row.expo_push_token
          ? {
              to: row.expo_push_token,
              title: RECAP_TITLE,
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
            }
          : null,
      });
    } catch (err) {
      // Per-user compute failure: silent skip + structured log. Do NOT
      // fall back to the generic body. The next cron retries.
      const errMsg = (err as Error)?.message ?? "unknown";
      console.log(
        JSON.stringify({
          at: "push.weekly_recap",
          phase: "recap_failed",
          userId: row.id,
          error: errMsg,
        }),
      );
      captureRouteError(err, "/api/push/weekly-recap", { phase: "recap_compute", userId: row.id });
      // B10 (2026-05-11) — per-user outcome telemetry. Compute failure
      // is still a real attempt the user didn't see a push from; surface
      // it so the dashboard tracks it separately from "no token" /
      // "deregistered" / "send_failed".
      const wsd: "monday" | "sunday" = row.week_start_day === "sunday" ? "sunday" : "monday";
      const descriptor = previousWeekDescriptor(wsd, nowDate);
      void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, row.id, {
        outcome: "compute_failed",
        weekKey: descriptor.weekKey,
        errorCode: errMsg.slice(0, 200),
      });
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

  // 8. Mobile (Expo) fan-out. ENG-748 #7: only compose entries WITH an
  //    Expo message go to Expo; web-only users (`message: null`) are
  //    handled in the Web Push fan-out below. If every eligible user is
  //    web-only, the Expo batch is empty — we skip the Expo POST entirely
  //    rather than POST an empty array (which Expo would reject) and we
  //    do NOT treat that as a failure.
  const mobileComposed = composed.filter(
    (c): c is Composed & { message: ExpoPushMessage } => c.message !== null,
  );
  const messages = mobileComposed.map((c) => c.message);

  const succeededUserIds: string[] = [];
  const deregisteredUserIds: string[] = [];

  if (messages.length > 0) {
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
      // B10 (2026-05-11) — per-user outcome telemetry. The whole batch
      // failed at the Expo API layer; emit a `send_failed` outcome for
      // every user that would have been in the batch so the dashboard
      // doesn't undercount this case as silent.
      for (const c of mobileComposed) {
        void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
          outcome: "send_failed",
          weekKey: c.weekKey,
          bodyVariant: c.bodyVariant,
          errorCode: result.error?.slice(0, 200) ?? "unknown",
        });
      }
      return NextResponse.json(
        { ok: false, error: "send_failed", message: result.error, statusCode: result.statusCode },
        { status: 502 },
      );
    }

    // Post-send bookkeeping. For every successful ticket, stamp
    // `last_weekly_recap_push_sent_at` and emit `weekly_recap_push_sent`
    // (T6). For every DeviceNotRegistered ticket, null the token so we
    // stop pushing to a dead install.
    const deregisteredSet = new Set(result.deregisteredTokens);

    for (let i = 0; i < messages.length; i += 1) {
      const ticket = result.tickets[i];
      const c = mobileComposed[i];
      if (!ticket || !c) continue;

      if (deregisteredSet.has(messages[i].to)) {
        deregisteredUserIds.push(c.row.id);
        // B10 (2026-05-11) — per-user outcome telemetry: deregistered.
        void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
          outcome: "deregistered",
          weekKey: c.weekKey,
          bodyVariant: c.bodyVariant,
          errorCode: "DeviceNotRegistered",
        });
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
        // B10 (2026-05-11) — also emit the unified outcome event so the
        // dashboard can compute % succeeded across all attempts in one
        // query (no joining required between sent + attempted).
        void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
          outcome: "sent",
          weekKey: c.weekKey,
          bodyVariant: c.bodyVariant,
        });
      } else if (ticket.status === "error") {
        // B10 (2026-05-11) — per-user outcome telemetry: ticket error
        // (MessageTooBig, InvalidCredentials, etc.). The next cron run
        // retries these, but we emit the failure now so the dashboard
        // sees the spike if a deploy regresses message size.
        void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
          outcome: "ticket_error",
          weekKey: c.weekKey,
          bodyVariant: c.bodyVariant,
          errorCode: ticket.details?.error ?? ticket.message?.slice(0, 200) ?? "unknown",
        });
      }
    }

    // B10 (2026-05-11) — `result.invalidTokens` are tokens our local
    // regex rejected before POSTing. Map back to user ids via the
    // message index. These weren't in `messages` (the helper filtered
    // them), so we look them up from `mobileComposed` by token match.
    if (result.invalidTokens.length > 0) {
      const invalidSet = new Set(result.invalidTokens);
      for (const c of mobileComposed) {
        if (invalidSet.has(c.message.to)) {
          void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
            outcome: "invalid_token",
            weekKey: c.weekKey,
            errorCode: "local_regex_rejected",
          });
        }
      }
    }
  }

  const nowIso = new Date(now).toISOString();

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

  // 9. Web Push fan-out. ENG-748 #7: this now covers BOTH web-only users
  //    (no Expo token) and dual-rail users (Expo + browser), reusing the
  //    `webSubsByUser` map built in step 4a (no second DB read). For
  //    every composed user with at least one browser subscription we
  //    send the identical title/body. A web-push success is a real
  //    delivery, so it contributes to `webSucceededUserIds` and the
  //    `last_weekly_recap_push_sent_at` stamp below — otherwise a
  //    web-only user would be re-pushed on every hourly cron inside their
  //    tz window until the 6-day dedupe lapsed.
  //
  //    VAPID not configured → `sendWebPushFanout` short-circuits with
  //    `vapidUnset`; we log the phase + emit a per-user `vapid_unset`
  //    outcome so a misconfigured deploy is never silent, and we do NOT
  //    stamp those users (no push was actually delivered).
  let webSent = 0;
  let webDeadCount = 0;
  let webFailed = 0;
  let webVapidUnset = false;
  const webSucceededUserIds: string[] = [];
  if (webSubsByUser.size > 0) {
    const deadEndpoints: string[] = [];
    for (const c of composed) {
      const subs = webSubsByUser.get(c.row.id);
      if (!subs || subs.length === 0) continue;
      const res = await sendWebPushFanout(subs, {
        title: c.title,
        body: c.body,
        url: "/home?view=progress",
        tag: `weekly_recap:${c.weekKey}`,
      });
      webSent += res.sent;
      webFailed += res.failed;
      if (res.vapidUnset) {
        webVapidUnset = true;
        // Emit a per-user outcome for the web-only users we couldn't
        // reach — never silent. (Dual-rail users already got a mobile
        // `sent`/`ticket_error`, so we only surface this for web-only.)
        if (!c.message) {
          void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
            outcome: "send_failed",
            weekKey: c.weekKey,
            bodyVariant: c.bodyVariant,
            errorCode: "web_vapid_unset",
          });
        }
        break;
      }
      if (res.sent > 0) {
        webSucceededUserIds.push(c.row.id);
        // Per-user outcome for web-only users (dual-rail users already
        // emitted a mobile outcome above; we don't double-count them).
        if (!c.message) {
          void serverTrack(AnalyticsEvents.weekly_recap_push_sent, c.row.id, {
            weekKey: c.weekKey,
            bodyVariant: c.bodyVariant,
            suggestionRule: c.suggestionRule,
          });
          void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
            outcome: "sent",
            weekKey: c.weekKey,
            bodyVariant: c.bodyVariant,
          });
        }
      } else if (res.failed > 0 && !c.message) {
        // Web-only user, all browser subs failed (no dead, transient
        // network). Surface it so the dashboard tracks it; the next cron
        // retries (no stamp written → still inside the eligible set).
        void serverTrack(AnalyticsEvents.weekly_recap_push_attempted, c.row.id, {
          outcome: "send_failed",
          weekKey: c.weekKey,
          bodyVariant: c.bodyVariant,
          errorCode: "web_push_failed",
        });
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

  // 10. Stamp `last_weekly_recap_push_sent_at` for every user who got a
  //     real delivery on EITHER rail (Expo success ∪ web-push success),
  //     deduped. Stamping after the web fan-out is what stops web-only
  //     users being re-pushed every hourly cron inside their tz window.
  const stampUserIds = Array.from(
    new Set([...succeededUserIds, ...webSucceededUserIds]),
  );
  if (stampUserIds.length > 0) {
    const { error: stampErr } = await supabase
      .from("profiles")
      .update({ last_weekly_recap_push_sent_at: nowIso })
      .in("id", stampUserIds);
    if (stampErr) {
      console.log(
        JSON.stringify({
          at: "push.weekly_recap",
          phase: "stamp_failed",
          count: stampUserIds.length,
          error: stampErr.message,
        }),
      );
    }
  }

  console.log(
    JSON.stringify({
      at: "push.weekly_recap",
      attempted,
      succeeded: stampUserIds.length,
      mobileSucceeded: succeededUserIds.length,
      webSucceeded: webSucceededUserIds.length,
      deregistered: deregisteredUserIds.length,
      webSent,
      webDead: webDeadCount,
      webFailed,
      webVapidUnset,
    }),
  );

  // ENG-748 #7: `succeeded` is the count of users who got a real
  // delivery on EITHER rail (mobile Expo ∪ browser Web Push), deduped —
  // i.e. `stampUserIds.length`. For mobile-only cohorts this equals the
  // old mobile-only count, so existing callers/tests are unaffected.
  return NextResponse.json({
    ok: true,
    attempted,
    succeeded: stampUserIds.length,
    deregistered: deregisteredUserIds.length,
  });
}

// ─────────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────────

function numOr(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

