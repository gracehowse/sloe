#!/usr/bin/env node
/**
 * Blocker 2 (2026-05-14 production-readiness audit) — Stripe webhook
 * forensic-replay script.
 *
 * Why this exists:
 *   When a production Stripe webhook event was *delivered* (Stripe got
 *   a 200 back) but *processed incorrectly* (handler bug, transient DB
 *   blip mid-handler, wrong tier write) — the Stripe dashboard won't
 *   offer "Resend" because to Stripe it succeeded. We still need to
 *   re-run the event through the (now fixed) handler.
 *
 *   This script fetches the canonical payload from the Stripe API,
 *   constructs a valid `stripe-signature` HMAC, and POSTs it to a
 *   configurable webhook endpoint (local dev by default; production
 *   only with --endpoint override and clear intent).
 *
 *   The handler is idempotent — see `src/lib/stripe/webhookProcess.ts`
 *   L101-119 — so re-running an already-processed event is a safe
 *   no-op (dedup row in `stripe_webhook_events` short-circuits the
 *   handler before the dispatch table runs).
 *
 * Usage (from repo root):
 *
 *   # One event, against a locally-running dev server:
 *   STRIPE_SECRET_KEY=sk_live_or_test... \
 *   STRIPE_WEBHOOK_SECRET=whsec_... \
 *   node scripts/replay-stripe-event.mjs --event-id evt_1Nq...
 *
 *   # Against a different endpoint:
 *   node scripts/replay-stripe-event.mjs \
 *     --event-id evt_1Nq... \
 *     --endpoint https://suppr.app/api/stripe/webhook
 *
 *   # Multiple events via xargs:
 *   cat /tmp/forensic-events.txt | xargs -I{} \
 *     node scripts/replay-stripe-event.mjs --event-id {}
 *
 * Exit codes:
 *   0 — POST succeeded with 2xx response.
 *   1 — config missing / Stripe fetch failed / non-2xx from endpoint.
 *   2 — argv parse / missing --event-id.
 *
 * Companion runbook: docs/operations/stripe-webhook-replay-runbook.md
 *                    § Forensic replay
 */

import crypto from "node:crypto";
import process from "node:process";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY?.trim();
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET?.trim();

function fail(message, code = 1) {
  console.error(`[stripe-replay] FAIL: ${message}`);
  process.exit(code);
}

function ok(message) {
  console.log(`[stripe-replay] OK: ${message}`);
}

function info(message) {
  console.log(`[stripe-replay] ${message}`);
}

function parseArgs(argv) {
  const out = { eventId: null, endpoint: "http://localhost:3000/api/stripe/webhook", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--event-id" || a === "-e") {
      out.eventId = argv[++i]?.trim() ?? null;
    } else if (a === "--endpoint") {
      out.endpoint = argv[++i]?.trim() ?? out.endpoint;
    } else if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--help" || a === "-h") {
      console.log(
        `Usage: node scripts/replay-stripe-event.mjs --event-id evt_... [--endpoint URL] [--dry-run]\n\n` +
          `  --event-id   Stripe event id to replay (required).\n` +
          `  --endpoint   Webhook endpoint to POST to. Default: http://localhost:3000/api/stripe/webhook.\n` +
          `  --dry-run    Build the request but do not POST; print the payload + signature.\n\n` +
          `Env required:\n` +
          `  STRIPE_SECRET_KEY      — fetches the event payload from Stripe API.\n` +
          `  STRIPE_WEBHOOK_SECRET  — signs the replay so the handler accepts it.\n\n` +
          `Companion runbook: docs/operations/stripe-webhook-replay-runbook.md`,
      );
      process.exit(0);
    } else if (a.startsWith("--")) {
      fail(`unknown flag: ${a}`, 2);
    }
  }
  return out;
}

/**
 * Build the `stripe-signature` header value for a given raw body.
 *
 * Stripe's format (per https://stripe.com/docs/webhooks/signatures):
 *   t=<unix-timestamp>,v1=<hex-hmac-sha256>
 *
 * The signed payload is `${timestamp}.${rawBody}`.
 * The signing key is the webhook signing secret (`whsec_...`).
 *
 * The Stripe SDK's `webhooks.constructEvent` parses this header,
 * verifies the HMAC, and rejects timestamps older than 5 minutes
 * (default tolerance). The current `now()` we generate keeps the
 * replay inside tolerance.
 */
function signPayload(rawBody, secret, timestampSec) {
  const signedPayload = `${timestampSec}.${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  return `t=${timestampSec},v1=${hmac}`;
}

/**
 * Fetch the canonical event payload from Stripe.
 *
 * Stripe's `Event` API returns the event in the same JSON shape that
 * was originally POSTed to the webhook — meaning re-serialising it
 * and POSTing produces a request the handler treats identically to
 * the original. This is by design: the handler's idempotency relies
 * on `event.id` (the persisted dedup primitive), not on byte-equality
 * of the body.
 *
 * Auth: bearer token using the `STRIPE_SECRET_KEY`.
 */
async function fetchEvent(eventId) {
  const url = `https://api.stripe.com/v1/events/${encodeURIComponent(eventId)}`;
  const res = await fetch(url, {
    headers: {
      authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      // Pin a Stripe-Version if you want to lock the response shape.
      // Omitted here so we match whatever the SDK in package.json uses.
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Stripe API returned ${res.status} for ${eventId}: ${body.slice(0, 500)}`);
  }
  return res.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.eventId) {
    fail("--event-id is required. Try --help.", 2);
  }
  if (!args.eventId.startsWith("evt_")) {
    info(
      `WARN: event id "${args.eventId}" does not start with "evt_" — Stripe events ` +
        `normally do. Continuing anyway.`,
    );
  }
  if (!STRIPE_SECRET_KEY) {
    fail("STRIPE_SECRET_KEY is unset. Cannot fetch the event payload from Stripe.");
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    fail("STRIPE_WEBHOOK_SECRET is unset. Cannot sign the replay request.");
  }

  info(`event_id = ${args.eventId}`);
  info(`endpoint = ${args.endpoint}`);

  // 1. Fetch the canonical event from Stripe.
  let event;
  try {
    event = await fetchEvent(args.eventId);
  } catch (e) {
    fail(`Stripe fetch failed: ${e?.message ?? e}`);
  }
  ok(`fetched canonical event from Stripe (type="${event?.type ?? "unknown"}")`);

  // 2. Serialise + sign.
  // Use a stable JSON representation. Stripe's API returns a fully
  // hydrated event object that round-trips through JSON.stringify
  // without losing fidelity (no BigInts, no Dates — all already
  // numbers / strings).
  const rawBody = JSON.stringify(event);
  const timestampSec = Math.floor(Date.now() / 1000);
  const signatureHeader = signPayload(rawBody, STRIPE_WEBHOOK_SECRET, timestampSec);

  if (args.dryRun) {
    info("--dry-run — not POSTing.");
    console.log("stripe-signature:", signatureHeader);
    console.log("body (first 500 chars):", rawBody.slice(0, 500));
    process.exit(0);
  }

  // 3. POST to the handler.
  let res;
  try {
    res = await fetch(args.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signatureHeader,
      },
      body: rawBody,
    });
  } catch (e) {
    fail(`POST to ${args.endpoint} threw: ${e?.message ?? e}`);
  }

  const responseText = await res.text().catch(() => "");
  if (res.status < 200 || res.status >= 300) {
    fail(`handler returned ${res.status}: ${responseText.slice(0, 500)}`);
  }
  ok(`handler returned ${res.status}: ${responseText.slice(0, 200)}`);

  // 4. Interpret the response.
  // The handler returns `{ received: true }` on success. If the event
  // was already in `stripe_webhook_events`, the dedup short-circuit
  // still returns `{ received: true }` (Stripe doesn't need to know
  // whether dedup fired — it just needs a 2xx). So a 200 here means
  // "the request was accepted"; whether the dispatch table ran is
  // visible only via the side effects (profiles.user_tier write) and
  // the row count in `stripe_webhook_events`.
  //
  // Verify side-effects out-of-band:
  //   select event_id, received_at from public.stripe_webhook_events
  //   where event_id = '<the-event-id>';
  //
  //   select id, email, user_tier, updated_at from public.profiles
  //   where stripe_customer_id is not null
  //   order by updated_at desc limit 5;
  //
  info(
    "Verify side effects via SQL — see " +
      "docs/operations/stripe-webhook-replay-runbook.md § Forensic replay.",
  );
  console.log("[stripe-replay] SUCCESS");
}

main().catch((e) => {
  console.error("[stripe-replay] unhandled error:", e?.message ?? e);
  process.exit(1);
});
