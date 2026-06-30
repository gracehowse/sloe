/**
 * POST /api/push/weigh-in-reminder
 *
 * ENG-955 — gentle, opt-in weigh-in reminder push (anti-nag).
 *
 * Server-side dual-rail fan-out of a calm weekly weigh-in nudge, fired only
 * for users who opted IN and only on their chosen local weekday + hour. This
 * route is modelled on `app/api/push/weekly-recap/route.ts` — same auth
 * (`X-Cron-Secret`), same service-role select, same Expo + Web Push fan-out,
 * same DeviceNotRegistered / dead-endpoint cleanup, same hard row cap, same
 * structured `{ at, attempted, succeeded, ... }` log line — but the
 * eligibility + copy live in the pure, headless-tested core
 * `src/lib/push/weighInReminder.ts` instead of the recap compute.
 *
 * Invocation chain:
 *   Vercel cron (hourly) → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *     → service-role select of profiles with a weigh-in reminder opt-in in
 *       `notification_prefs`
 *     → per-user `decideWeighInReminder(...)`: opt-in + tz-aware window +
 *       6-day dedupe + anti-nag (skip if already weighed in this period)
 *     → cross-reference `web_push_subscriptions`, drop candidates with no rail
 *     → mobile: `sendExpoPush` → Expo → APNs; web: `sendWebPushFanout` (VAPID)
 *     → post-send stamps `last_weigh_in_reminder_sent_at` for every user
 *       delivered on either rail, nulls `expo_push_token` for
 *       DeviceNotRegistered rows, deletes dead web-push endpoints, and emits
 *       `weigh_in_reminder_push_attempted` per attempt.
 *
 * Anti-nag is the whole point: the route never lands a reminder on top of a
 * fresh weigh-in (the core's `already_logged_this_period` gate) and never
 * double-fires inside the 6-day dedupe window. The copy is warm and
 * trend-framed — never a streak/badge/threat (pinned by the core's tests).
 *
 * Live-DB dependency: assumes the
 * `20260702120500_profiles_weigh_in_reminder_dedupe.sql` migration (adds
 * `last_weigh_in_reminder_sent_at`) is applied. Without it the post-send
 * stamp UPDATE throws; there is no defensive fallback by design.
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { timingSafeEqual } from "crypto";

import { sendExpoPush, type ExpoPushMessage } from "@/lib/push/expoPush";
import { sendWebPushFanout } from "@/lib/push/webPushSend";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import {
  buildWeighInReminderCopy,
  decideWeighInReminder,
  parseWeighInReminderPref,
} from "@/lib/push/weighInReminder";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { serverTrack } from "@/lib/analytics/serverTrack";
import { captureRouteError } from "@/lib/observability/captureRouteError";

/** Maximum rows this route will fan out to per invocation. */
const MAX_ROWS_PER_INVOCATION = 5000;

type ProfileRow = {
  id: string;
  expo_push_token: string | null;
  last_weigh_in_reminder_sent_at: string | null;
  tz_iana?: string | null;
  weight_kg_by_day?: unknown;
  notification_prefs?: unknown;
};

/** Columns the server-side `select` pulls. Centralised so the test fixture
 *  and the runtime call cannot drift. */
const PROFILE_SELECT_COLUMNS = [
  "id",
  "expo_push_token",
  "last_weigh_in_reminder_sent_at",
  "tz_iana",
  "weight_kg_by_day",
  "notification_prefs",
].join(", ");

/**
 * Constant-time string comparison for the cron shared secret. Mirrors the
 * weekly-recap route — `===` leaks secret length + prefix via timing.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Sentry Cron monitor — auto-provisions on first check-in. Schedule must
 *  match `vercel.json`; the reminder cron runs hourly because the user's
 *  chosen hour can be any of 24. */
const WEIGH_IN_REMINDER_MONITOR_CONFIG = {
  schedule: { type: "crontab" as const, value: "0 * * * *" },
  checkinMargin: 5,
  maxRuntime: 10,
  timezone: "UTC" as const,
};

export async function POST(req: Request) {
  return Sentry.withMonitor(
    "weigh-in-reminder-push",
    () => runWeighInReminderPush(req),
    WEIGH_IN_REMINDER_MONITOR_CONFIG,
  );
}

async function runWeighInReminderPush(req: Request) {
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

  // 2. Select candidate profiles. We can't filter the JSONB opt-in flag as a
  //    cheap SQL predicate portably here, so we pull rows with a non-null
  //    notification_prefs and apply the opt-in + window + dedupe + anti-nag
  //    gates in-memory via the pure core. The hard row cap bounds the worst
  //    case. (At ramp scale this can move to a generated boolean column +
  //    .eq filter; for the beta window the in-memory gate is correct and the
  //    opt-in cohort is tiny.)
  const { data: rows, error: selectErr } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .not("notification_prefs", "is", null)
    .range(0, MAX_ROWS_PER_INVOCATION - 1);
  if (selectErr) {
    console.log(
      JSON.stringify({
        at: "push.weigh_in_reminder",
        phase: "select_failed",
        error: selectErr.message,
      }),
    );
    return NextResponse.json(
      { ok: false, error: "select_failed", message: selectErr.message },
      { status: 500 },
    );
  }

  // 3. Eligibility — opt-in + tz-aware window + dedupe + anti-nag. All four
  //    gates live in the pure core so the cron and tests share one decision.
  const nowUtc = new Date();
  const eligible = ((rows ?? []) as unknown as ProfileRow[]).filter((r) => {
    const np = r.notification_prefs;
    const pref = parseWeighInReminderPref(
      np && typeof np === "object"
        ? (np as Record<string, unknown>).weighInReminder
        : null,
    );
    const decision = decideWeighInReminder(
      {
        pref,
        tzIana: r.tz_iana ?? null,
        weightKgByDay: parseWeightKgByDay(r.weight_kg_by_day),
        lastReminderSentAt: r.last_weigh_in_reminder_sent_at,
      },
      nowUtc,
    );
    return decision.send;
  });

  // 4. Cross-reference web subscriptions for the eligible set (one IN(...)).
  //    Web-sub fetch failure is non-fatal — log + continue mobile-only.
  type WebSub = { endpoint: string; p256dh: string; auth: string };
  const webSubsByUser = new Map<string, WebSub[]>();
  if (eligible.length > 0) {
    const eligibleIds = eligible.map((r) => r.id);
    const { data: webSubRows, error: webSelErr } = await supabase
      .from("web_push_subscriptions")
      .select("user_id, endpoint, p256dh, auth")
      .in("user_id", eligibleIds);
    if (webSelErr) {
      console.log(
        JSON.stringify({
          at: "push.weigh_in_reminder",
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

  // 5. Rail filter — eligible only if it has an Expo token OR a browser sub.
  const withRail = eligible.filter(
    (r) => Boolean(r.expo_push_token) || (webSubsByUser.get(r.id)?.length ?? 0) > 0,
  );

  const attempted = withRail.length;
  if (attempted === 0) {
    console.log(
      JSON.stringify({
        at: "push.weigh_in_reminder",
        attempted: 0,
        succeeded: 0,
        deregistered: 0,
      }),
    );
    return NextResponse.json({ ok: true, attempted: 0, succeeded: 0, deregistered: 0 });
  }

  // 6. Compose. The body is static warm copy from the core — no per-user
  //    compute, so there is no per-user compute-failure branch (the recap's
  //    risk surface doesn't exist here).
  const copy = buildWeighInReminderCopy();
  type Composed = {
    row: ProfileRow;
    message: ExpoPushMessage | null;
  };
  const composed: Composed[] = withRail.map((row) => ({
    row,
    message: row.expo_push_token
      ? {
          to: row.expo_push_token,
          title: copy.title,
          body: copy.body,
          data: { deepLink: "/progress", kind: "weigh_in_reminder" },
          sound: "default",
          priority: "high",
        }
      : null,
  }));

  // 7. Mobile (Expo) fan-out.
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
          at: "push.weigh_in_reminder",
          phase: "send_failed",
          attempted,
          error: result.error,
          statusCode: result.statusCode,
        }),
      );
      for (const c of mobileComposed) {
        void serverTrack(AnalyticsEvents.weigh_in_reminder_push_attempted, c.row.id, {
          outcome: "send_failed",
          rail: "expo",
          errorCode: result.error?.slice(0, 200) ?? "unknown",
        });
      }
      return NextResponse.json(
        { ok: false, error: "send_failed", message: result.error, statusCode: result.statusCode },
        { status: 502 },
      );
    }

    const deregisteredSet = new Set(result.deregisteredTokens);
    for (let i = 0; i < messages.length; i += 1) {
      const ticket = result.tickets[i];
      const c = mobileComposed[i];
      if (!ticket || !c) continue;

      if (deregisteredSet.has(messages[i].to)) {
        deregisteredUserIds.push(c.row.id);
        void serverTrack(AnalyticsEvents.weigh_in_reminder_push_attempted, c.row.id, {
          outcome: "deregistered",
          rail: "expo",
          errorCode: "DeviceNotRegistered",
        });
        continue;
      }
      if (ticket.status === "ok") {
        succeededUserIds.push(c.row.id);
        void serverTrack(AnalyticsEvents.weigh_in_reminder_push_attempted, c.row.id, {
          outcome: "sent",
          rail: "expo",
        });
      } else if (ticket.status === "error") {
        void serverTrack(AnalyticsEvents.weigh_in_reminder_push_attempted, c.row.id, {
          outcome: "ticket_error",
          rail: "expo",
          errorCode: ticket.details?.error ?? ticket.message?.slice(0, 200) ?? "unknown",
        });
      }
    }
  }

  const nowIso = nowUtc.toISOString();

  if (deregisteredUserIds.length > 0) {
    const { error: clearErr } = await supabase
      .from("profiles")
      .update({ expo_push_token: null })
      .in("id", deregisteredUserIds);
    if (clearErr) {
      console.log(
        JSON.stringify({
          at: "push.weigh_in_reminder",
          phase: "deregister_failed",
          count: deregisteredUserIds.length,
          error: clearErr.message,
        }),
      );
    }
  }

  // 8. Web Push fan-out — web-only + dual-rail users. A web-push success is a
  //    real delivery → contributes to the stamp set so a web-only user isn't
  //    re-pushed every hourly cron inside their window until the dedupe lapses.
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
        title: copy.title,
        body: copy.body,
        url: "/home?view=progress",
        tag: "weigh_in_reminder",
      });
      webSent += res.sent;
      webFailed += res.failed;
      if (res.vapidUnset) {
        webVapidUnset = true;
        if (!c.message) {
          void serverTrack(AnalyticsEvents.weigh_in_reminder_push_attempted, c.row.id, {
            outcome: "send_failed",
            rail: "web",
            errorCode: "web_vapid_unset",
          });
        }
        break;
      }
      if (res.sent > 0) {
        webSucceededUserIds.push(c.row.id);
        if (!c.message) {
          void serverTrack(AnalyticsEvents.weigh_in_reminder_push_attempted, c.row.id, {
            outcome: "sent",
            rail: "web",
          });
        }
      } else if (res.failed > 0 && !c.message) {
        void serverTrack(AnalyticsEvents.weigh_in_reminder_push_attempted, c.row.id, {
          outcome: "send_failed",
          rail: "web",
          errorCode: "web_push_failed",
        });
      }
      if (res.dead.length > 0) deadEndpoints.push(...res.dead);
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
            at: "push.weigh_in_reminder",
            phase: "web_delete_failed",
            count: deadEndpoints.length,
            error: webDelErr.message,
          }),
        );
      }
    }
  }

  // 9. Stamp every user delivered on EITHER rail, deduped.
  const stampUserIds = Array.from(
    new Set([...succeededUserIds, ...webSucceededUserIds]),
  );
  if (stampUserIds.length > 0) {
    const { error: stampErr } = await supabase
      .from("profiles")
      .update({ last_weigh_in_reminder_sent_at: nowIso })
      .in("id", stampUserIds);
    if (stampErr) {
      console.log(
        JSON.stringify({
          at: "push.weigh_in_reminder",
          phase: "stamp_failed",
          count: stampUserIds.length,
          error: stampErr.message,
        }),
      );
      captureRouteError(stampErr, "/api/push/weigh-in-reminder", { phase: "stamp" });
    }
  }

  console.log(
    JSON.stringify({
      at: "push.weigh_in_reminder",
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

/** Coerce a raw `weight_kg_by_day` JSONB value into a `Record<string, number>`.
 *  Tolerant of null / non-object / non-numeric values — anything malformed
 *  yields an empty map so the anti-nag gate treats it as "no weigh-ins". */
function parseWeightKgByDay(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
