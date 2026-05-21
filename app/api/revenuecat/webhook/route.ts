import { NextResponse } from "next/server";
import {
  processRevenueCatEvent,
  type RevenueCatEvent,
} from "@/lib/revenuecat/webhookProcess";
import { captureRouteError } from "@/lib/observability/captureRouteError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * T6 (full-sweep 2026-04-24) — RevenueCat webhook receiver.
 *
 * RC posts every billing event here (configured in the RC dashboard:
 * Project Settings → Integrations → Webhooks). The `Authorization`
 * header carries the static bearer secret you set in the dashboard;
 * we compare it against `REVENUECAT_WEBHOOK_AUTH` and 401 on mismatch.
 *
 * Events accepted (handled in webhookProcess.ts):
 *   - INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE / UNCANCELLATION /
 *     NON_RENEWING_PURCHASE / TEMPORARY_ENTITLEMENT_GRANT → tier
 *     resolved from `entitlement_ids` and persisted via service role
 *     when the entitlement payload is present.
 *   - CANCELLATION / BILLING_ISSUE → no-op (auto-renew off / grace
 *     period; entitlement still active).
 *   - EXPIRATION / SUBSCRIPTION_PAUSED → tier → free.
 *   - TRANSFER / REFUND / SUBSCRIPTION_EXTENDED → persisted but no-op
 *     in v0; forensic replay possible from `revenuecat_events.payload`.
 *
 * Idempotent: events are deduped on `event_id` via the
 * `revenuecat_events` primary key (sister to `stripe_webhook_events`,
 * T23). RC delivers at-least-once; the dedup guarantees once-only
 * tier writes.
 *
 * Setup checklist for Grace:
 *   1. RC dashboard → Project Settings → Integrations → + Webhook.
 *   2. URL: `https://<your-host>/api/revenuecat/webhook`.
 *   3. Authorization: any random secret you generate.
 *   4. Vercel env: `REVENUECAT_WEBHOOK_AUTH` = same secret.
 *   5. Vercel env: `SUPABASE_SERVICE_ROLE_KEY` already set.
 *   6. Test: RC has a "Send test event" button — should return 200.
 */

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(req: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH?.trim();
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        error: "revenuecat_webhook_not_configured",
        message: "Set REVENUECAT_WEBHOOK_AUTH and the RC dashboard webhook to match.",
      },
      { status: 503 },
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "supabase_service_role_missing",
        message: "Set SUPABASE_SERVICE_ROLE_KEY for tier updates.",
      },
      { status: 503 },
    );
  }

  // Authorization can be either bare ("Authorization: <secret>") or
  // bearer-prefixed ("Authorization: Bearer <secret>"). RC's dashboard
  // accepts either — accept both here for robustness.
  const authHeader = req.headers.get("authorization") ?? "";
  const presented = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : authHeader.trim();
  if (!presented || !constantTimeEqual(presented, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // RC nests under `event` for v1 webhooks, but some integrations send
  // the event flat. Accept either.
  const wrapped = (body as { event?: unknown })?.event;
  const candidate = (wrapped && typeof wrapped === "object" ? wrapped : body) as
    | Partial<RevenueCatEvent>
    | null;
  if (
    !candidate ||
    typeof candidate !== "object" ||
    typeof candidate.id !== "string" ||
    typeof candidate.type !== "string" ||
    typeof candidate.app_user_id !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "missing_event_fields" },
      { status: 400 },
    );
  }
  const event = candidate as RevenueCatEvent;

  try {
    const result = await processRevenueCatEvent(event);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.reason, message: "error" in result ? result.error : undefined },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, outcome: result.outcome });
  } catch (e) {
    const message = e instanceof Error ? e.message : "webhook_handler_error";
    console.error("revenuecat_webhook_handler", message);
    captureRouteError(e, "/api/revenuecat/webhook");
    return NextResponse.json({ ok: false, error: "handler_failed", message }, { status: 500 });
  }
}
