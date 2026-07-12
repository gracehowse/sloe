/**
 * POST /api/cron/entitlement-reconcile
 *
 * ENG-1463 / ENG-1437: the automated recovery path for a permanently
 * missed or failed payment webhook. `profiles.user_tier` is a
 * denormalised mirror of the payment processors' entitlement truth,
 * written only by the Stripe/RevenueCat webhooks and client-write-locked
 * otherwise — so nothing self-heals if a webhook is dropped. This cron
 * periodically compares Stripe's canonical subscription state against
 * `profiles.user_tier` and reconciles drift server-side, firing loudly
 * (Sentry) on every correction because a correction means a webhook was
 * missed.
 *
 * Scope + policy (full rationale in the lib module and in
 * `docs/decisions/2026-07-10-entitlement-reconciliation-cron.md`):
 *   - Stripe rail only for now; RevenueCat half tracked in ENG-1463.
 *   - Upgrade drift (paid but under-entitled) → auto-corrected.
 *   - Downgrade drift (Stripe not-entitled but tier higher) → detected
 *     + alerted, NOT auto-written (the user may be a legitimate App Store
 *     subscriber), unless `RECONCILE_STRIPE_AUTO_DOWNGRADE=true`.
 *   - `lifetime_pro` never touched.
 *
 * Invocation chain:
 *   GitHub Actions cron (.github/workflows/scheduled-crons.yml, every 6h)
 *     → POST here with `X-Cron-Secret: SUPPR_CRON_SECRET`
 *     → service-role client (bypasses the tier-column lockdown by design)
 *     → shared Stripe client (clean 200 skip if the rail isn't configured)
 *     → scan `stripe_customer_id IS NOT NULL` profiles, reconcile drift
 *     → structured no-PII summary log + Sentry per correction
 *
 * All implementation lives in `src/lib/server/entitlementReconcileJob.ts`
 * — Next's App Router route validator rejects non-handler exports from a
 * `route.ts` file.
 *
 * Env vars
 *   - `SUPPR_CRON_SECRET`               shared with all scheduled crons (GH Actions + Vercel, rotate together).
 *   - `SUPABASE_SERVICE_ROLE_KEY`       service-role write, bypasses the tier lockdown.
 *   - `STRIPE_SECRET_KEY`               Stripe read; absent → clean skip (pre-launch).
 *   - `STRIPE_PRICE_PRO_*` / `_BASE_*`  price→tier mapping (shared with checkout/webhook).
 *   - `RECONCILE_STRIPE_AUTO_DOWNGRADE` optional, default off — opt in to auto-applying downgrades.
 */
import { NextResponse } from "next/server";
import { runEntitlementReconcileRoute } from "../../../../src/lib/server/entitlementReconcileJob";
import { getSupabaseAdminClient } from "../../../../src/lib/supabase/serverAdminClient";
import { getStripeClient } from "../../../../src/lib/stripe/stripeClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function POST(req: Request): Promise<NextResponse> {
  return runEntitlementReconcileRoute(req, getSupabaseAdminClient, getStripeClient);
}

// Explicit 405 for GET — clearer than Next's default when the URL is hit
// in a browser.
export function GET(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed", message: "POST with X-Cron-Secret header" },
    { status: 405 },
  );
}
