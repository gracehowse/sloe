/**
 * POST /api/push/weekly-recap
 *
 * Server-side fan-out of the weekly recap push (TestFlight build 10
 * fix C — `AOjQg5DGBZqS5qNJ1Rqu960`, `APdpODtJDL8q2JhtGup6DK0`
 * follow-up to the 2026-04-18 token-capture shipment).
 *
 * Invocation chain:
 *   Vercel cron → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *                 → service-role select of opted-in profiles with a token
 *                 → `sendExpoPush` fans out to Expo → APNs → devices
 *                 → post-send writes `last_weekly_recap_push_sent_at` and
 *                   nulls `expo_push_token` for `DeviceNotRegistered` rows.
 *
 * Guardrails:
 *   - Auth is a shared-secret header, not a user JWT. This is a
 *     server-to-server route; user-scoped auth is the wrong shape.
 *   - Per-user dedupe is done via `last_weekly_recap_push_sent_at`
 *     (skip rows pushed in the last 6 days) — not IP rate limiting.
 *   - Hard cap of 5000 rows per invocation so a runaway table scan
 *     cannot blow past Vercel's cron timeout. Paginate across multiple
 *     invocations if the active-user base exceeds that.
 *   - Helper (`src/lib/push/expoPush.ts`) is the only file that knows
 *     about the Expo push API — keep network concerns there.
 */

import { NextResponse } from "next/server";

import { sendExpoPush, type ExpoPushMessage } from "@/lib/push/expoPush";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";

/** Maximum rows this route will fan out to per invocation. */
const MAX_ROWS_PER_INVOCATION = 5000;

/** Dedupe window — skip rows pushed more recently than this. */
const DEDUPE_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;

type ProfileRow = {
  id: string;
  expo_push_token: string | null;
  last_weekly_recap_push_sent_at: string | null;
  week_start_day?: string | null;
};

export async function POST(req: Request) {
  // 1. Auth gate — shared-secret header.
  const expected = process.env.SUPPR_CRON_SECRET;
  if (!expected || expected.length === 0) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured", message: "SUPPR_CRON_SECRET unset" },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-cron-secret");
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 2. Optional cohort filter (weekStartDay=monday|sunday).
  const { searchParams } = new URL(req.url);
  const cohort = searchParams.get("weekStartDay");
  const cohortFilter =
    cohort === "monday" || cohort === "sunday" ? cohort : null;

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

  // 3. Select enabled rows with a synced token. Apply the optional
  //    cohort filter BEFORE `.range(...)` — `.range` is the final
  //    builder call supabase-js consumes.
  let query = supabase
    .from("profiles")
    .select("id, expo_push_token, last_weekly_recap_push_sent_at, week_start_day")
    .eq("weekly_recap_push_enabled", true)
    .not("expo_push_token", "is", null);

  if (cohortFilter) {
    query = query.eq("week_start_day", cohortFilter);
  }

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

  const now = Date.now();
  const eligible = ((rows ?? []) as ProfileRow[]).filter((r) => {
    if (!r.expo_push_token) return false;
    if (!r.last_weekly_recap_push_sent_at) return true;
    const lastSentMs = Date.parse(r.last_weekly_recap_push_sent_at);
    if (!Number.isFinite(lastSentMs)) return true;
    return now - lastSentMs >= DEDUPE_WINDOW_MS;
  });

  const attempted = eligible.length;
  if (attempted === 0) {
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        cohort: cohortFilter,
        attempted: 0,
        succeeded: 0,
        deregistered: 0,
      }),
    );
    return NextResponse.json({ ok: true, attempted: 0, succeeded: 0, deregistered: 0 });
  }

  // 4. Compose one message per row. Keep copy aligned with the mobile
  //    local-push copy in `apps/mobile/lib/weeklyRecapPush.ts` so users
  //    whose delivery flips between local and remote do not see
  //    different wording week-to-week.
  const messages: ExpoPushMessage[] = eligible.map((r) => ({
    to: r.expo_push_token as string,
    title: "Your week in Suppr",
    body: "Tap to see your weekly recap — avg calories, protein, streak, and weight trend.",
    data: { deepLink: "/progress", kind: "weekly_recap" },
    sound: "default",
    priority: "high",
  }));

  const result = await sendExpoPush(messages);

  if (!result.ok) {
    console.log(
      JSON.stringify({
        at: "push.weekly_recap",
        cohort: cohortFilter,
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

  // 5. Post-send bookkeeping. For every successful ticket, stamp
  //    `last_weekly_recap_push_sent_at`. For every DeviceNotRegistered
  //    ticket, null the token so we stop pushing to a dead install.
  const deregisteredSet = new Set(result.deregisteredTokens);
  const succeededUserIds: string[] = [];
  const deregisteredUserIds: string[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const ticket = result.tickets[i];
    const row = eligible[i];
    if (!ticket || !row) continue;

    if (deregisteredSet.has(messages[i].to)) {
      deregisteredUserIds.push(row.id);
      continue;
    }
    if (ticket.status === "ok") {
      succeededUserIds.push(row.id);
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

  console.log(
    JSON.stringify({
      at: "push.weekly_recap",
      cohort: cohortFilter,
      attempted,
      succeeded: succeededUserIds.length,
      deregistered: deregisteredUserIds.length,
      invalidTokens: result.invalidTokens.length,
    }),
  );

  return NextResponse.json({
    ok: true,
    attempted,
    succeeded: succeededUserIds.length,
    deregistered: deregisteredUserIds.length,
  });
}
