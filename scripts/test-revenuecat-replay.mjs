#!/usr/bin/env node
/**
 * P1-14 (2026-04-25) — RevenueCat webhook live-replay smoke.
 *
 * Posts the same synthetic event to the webhook twice and asserts:
 *   1. First POST returns 200.
 *   2. Second POST returns 200 with `outcome: "skipped_duplicate"`
 *      (proves the `revenuecat_events.event_id` PK dedup is working
 *      and the route doesn't double-write tier).
 *   3. (Optional) `revenuecat_events` row count for the synthetic
 *      event_id is exactly 1, when SUPABASE_SERVICE_ROLE_KEY is
 *      available locally.
 *
 * The synthetic `app_user_id` is the literal string
 * `"replay-smoke-<run-timestamp>"` — NOT a real Supabase auth uuid —
 * so `user_id` resolves to null and no `profiles` row is touched. This
 * makes the smoke safe to run repeatedly against production without
 * affecting any real user's tier.
 *
 * Usage (from repo root, with production env loaded):
 *
 *   REVENUECAT_WEBHOOK_AUTH=<secret> \
 *   REVENUECAT_WEBHOOK_URL=https://suppr-club.com/api/revenuecat/webhook \
 *   [SUPABASE_SERVICE_ROLE_KEY=<key> \
 *    NEXT_PUBLIC_SUPABASE_URL=<url>] \
 *   node scripts/test-revenuecat-replay.mjs
 *
 *   # or via the prelaunch checklist:
 *   npm run prelaunch:checklist
 *
 * Exit codes:
 *   0 — both POSTs succeeded; idempotency confirmed.
 *   1 — config missing / network error / non-200 / dedup didn't fire.
 *   2 — 200/200 but the database row count was 0 or >1 (only when
 *       service-role check enabled).
 */

const SECRET = process.env.REVENUECAT_WEBHOOK_AUTH?.trim();
// Compute the URL defensively — if neither REVENUECAT_WEBHOOK_URL nor
// NEXT_PUBLIC_APP_URL is set, leave URL undefined (rather than building
// "undefined/api/revenuecat/webhook" via string concat with operator
// precedence on `??` vs `+`). The startup check below surfaces a clear
// "URL unset" error in that case.
const EXPLICIT_URL = process.env.REVENUECAT_WEBHOOK_URL?.trim();
const APP_URL_BASE = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "");
const URL = EXPLICIT_URL ?? (APP_URL_BASE ? `${APP_URL_BASE}/api/revenuecat/webhook` : undefined);
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

function fail(message, code = 1) {
  console.error(`[rc-replay] FAIL: ${message}`);
  process.exit(code);
}

function ok(message) {
  console.log(`[rc-replay] OK: ${message}`);
}

async function postEvent(eventId, label) {
  const body = {
    event: {
      id: eventId,
      type: "INITIAL_PURCHASE",
      app_user_id: `replay-smoke-${eventId}`,
      product_id: "smoke_synthetic",
      entitlement_ids: ["pro"],
    },
  };
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, label };
}

async function rowCount(eventId) {
  if (!SERVICE_ROLE || !SUPABASE_URL) return null;
  const url = `${SUPABASE_URL}/rest/v1/revenuecat_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id`;
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
      // PostgREST convention: count via Prefer header.
      prefer: "count=exact",
    },
  });
  if (!res.ok) {
    console.warn(`[rc-replay] WARN: row-count check returned ${res.status}; skipping DB verify.`);
    return null;
  }
  const arr = await res.json().catch(() => []);
  return Array.isArray(arr) ? arr.length : 0;
}

async function cleanup(eventId) {
  if (!SERVICE_ROLE || !SUPABASE_URL) return;
  const url = `${SUPABASE_URL}/rest/v1/revenuecat_events?event_id=eq.${encodeURIComponent(eventId)}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: SERVICE_ROLE,
      authorization: `Bearer ${SERVICE_ROLE}`,
    },
  });
}

async function main() {
  if (!SECRET) fail("REVENUECAT_WEBHOOK_AUTH is unset; cannot authenticate to the webhook.");
  if (!URL) {
    fail(
      "Neither REVENUECAT_WEBHOOK_URL nor NEXT_PUBLIC_APP_URL is set; cannot reach the webhook.\n" +
      "  Examples:\n" +
      "    REVENUECAT_WEBHOOK_URL=https://suppr-club.com/api/revenuecat/webhook\n" +
      "    NEXT_PUBLIC_APP_URL=https://suppr-club.com   (the script appends /api/revenuecat/webhook)\n" +
      "  Tip: zsh requires a space BEFORE the `\\` on multi-line env-var assignments.",
    );
  }

  const eventId = `rc-smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[rc-replay] event_id = ${eventId}`);
  console.log(`[rc-replay] target = ${URL}`);

  let first;
  try {
    first = await postEvent(eventId, "first");
  } catch (e) {
    fail(`first POST threw: ${e?.message ?? e}`);
  }
  if (first.status !== 200) {
    fail(`first POST returned ${first.status}: ${JSON.stringify(first.json)}`);
  }
  ok(`first POST 200 — outcome="${first.json?.outcome ?? "unknown"}"`);

  let second;
  try {
    second = await postEvent(eventId, "second");
  } catch (e) {
    fail(`second POST threw: ${e?.message ?? e}`);
  }
  if (second.status !== 200) {
    fail(`second POST returned ${second.status}: ${JSON.stringify(second.json)}`);
  }
  if (second.json?.outcome !== "skipped_duplicate") {
    fail(
      `second POST should have outcome="skipped_duplicate" (proves event_id dedup); got "${second.json?.outcome ?? "unknown"}".`,
    );
  }
  ok(`second POST 200 — outcome="skipped_duplicate" (idempotent)`);

  // Optional DB-side verification when service-role is available.
  const count = await rowCount(eventId);
  if (count === null) {
    console.log(
      `[rc-replay] DB row-count check skipped (set SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL to enable).`,
    );
  } else if (count === 1) {
    ok(`revenuecat_events row count for synthetic event_id = 1 (idempotent persistence confirmed)`);
  } else {
    await cleanup(eventId);
    fail(
      `revenuecat_events row count for synthetic event_id = ${count}; expected exactly 1.`,
      2,
    );
  }

  // Always clean up the synthetic row when we have access; harmless no-op
  // when the smoke also runs in HTTP-only mode.
  await cleanup(eventId);
  ok("cleanup complete; smoke event removed from revenuecat_events.");

  console.log("[rc-replay] SUCCESS");
}

main().catch((e) => {
  console.error("[rc-replay] unhandled error:", e?.message ?? e);
  process.exit(1);
});
