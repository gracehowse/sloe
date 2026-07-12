/**
 * Server-side helpers for `POST /api/cron/entitlement-reconcile`
 * (ENG-1463 / ENG-1437).
 *
 * ## Why this job exists
 *
 * `profiles.user_tier` is a denormalised mirror of the payment
 * processors' entitlement truth. The ONLY writers are the Stripe and
 * RevenueCat webhooks (via `updateProfileTierServiceRole`) — the column
 * is client-write-locked (42501) by the tier-lockdown migration, so
 * nothing self-heals client-side. `founder-safety-net.md` §4b used to
 * claim a missed webhook "self-corrects on next launch"; it does not.
 *
 * If a webhook is permanently missed or fails (a first-transaction
 * config error is the single most likely launch failure — neither rail
 * has ever processed a real transaction), a customer can be stranded on
 * the wrong tier until someone corrects it by hand. This job is the
 * automated recovery path: it periodically compares Stripe's canonical
 * subscription state against `profiles.user_tier` and reconciles drift
 * server-side (service-role write, bypassing the client lockdown by
 * design). Every correction fires loudly — a correction happening at all
 * means a webhook was missed, which is itself worth investigating.
 *
 * ## Scope: Stripe now, RevenueCat later (deliberate, not partial)
 *
 * This job reconciles the **Stripe** rail only. That is deliberate and
 * matches the launch-sequencing decision (`docs/decisions/
 * 2026-07-06-launch-sequencing-revenue-rails.md`): TestFlight purchases
 * clear through Apple's sandbox, so Stripe is currently the only rail
 * that can take a real payment — and the only one whose drift can strand
 * a *paying* customer. The RevenueCat half needs an outbound RC REST
 * secret key that is not yet provisioned; it is tracked, not silently
 * skipped, in ENG-1463 and gated by the "cross-rail" caveat below.
 *
 * ## Correction policy — asymmetric on purpose
 *
 * The two drift directions do NOT carry equal risk:
 *
 *   - **Upgrade drift** (Stripe says entitled, `user_tier` is lower):
 *     a paying customer is being under-served. Auto-corrected — granting
 *     a tier the customer has demonstrably paid for is always safe.
 *
 *   - **Downgrade drift** (Stripe says NOT entitled, `user_tier` is
 *     higher): by default this is DETECTED and ALERTED, but NOT written.
 *     A user with a canceled Stripe subscription can be a legitimate
 *     App Store (RevenueCat) subscriber — auto-downgrading them would
 *     lock a paying customer out of Pro, the worst possible failure.
 *     Without RevenueCat truth we cannot rule that out, so we surface
 *     downgrade candidates for review rather than acting blind. Once RC
 *     reconciliation exists (ENG-1463), the cross-rail case can be ruled
 *     out and auto-downgrade enabled. `RECONCILE_STRIPE_AUTO_DOWNGRADE=
 *     true` opts in early (e.g. if the product stays web-only).
 *
 * `lifetime_pro` is never touched (founding comp is durable — mirrors
 * `updateProfileTierServiceRole`'s own floor-protection, belt and
 * braces).
 *
 * ## Auditability
 *
 * One structured `at: "cron.entitlement_reconcile"` summary line per run
 * (counts only, no PII). Per-user drift is reported to Sentry (uuids
 * only) so a correction pages someone, matching the alerting bar of the
 * other scheduled crons (`supabaseAdvisorCheck.ts`).
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import type { UserTier } from "@/types/recipe";
import { tierFromStripePriceIds } from "@/lib/stripe/tierFromPrice";
import { tierRank } from "@/lib/tier/tierRank";
import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";

/**
 * Constant-time string compare for the cron-secret gate. Mirrors the
 * identical helper in `householdPurgeJob.ts` / `supabaseAdvisorCheck.ts`
 * — the established per-cron-lib convention (a route file cannot export a
 * shared helper without tripping Next's App Router validator, and each
 * cron lib carries its own tiny copy rather than importing across crons).
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Stripe subscription statuses that ENTITLE the customer to their tier.
 * Mirrors the webhook's `applyTierForSubscription` (webhookProcess.ts):
 * active / trialing / paused / past_due keep the tier (past_due is still
 * in the dunning grace window); canceled / unpaid / incomplete /
 * incomplete_expired do not. Keeping this in lockstep with the webhook is
 * the whole point — the cron must resolve tier the same way the missed
 * webhook would have.
 */
export const STRIPE_ENTITLING_STATUSES: ReadonlySet<Stripe.Subscription.Status> =
  new Set(["active", "trialing", "paused", "past_due"]);

/** Minimal shape this job reads off a Stripe subscription (keeps the fake in tests small). */
export interface ReconcilableSubscription {
  status: Stripe.Subscription.Status;
  items: { data: Array<{ price?: { id?: string | null } | null }> };
}

/**
 * The tier a customer SHOULD hold given their full set of Stripe
 * subscriptions: the highest tier across every *entitling* subscription,
 * or `"free"` if none entitle. Considers all subscriptions (a customer
 * can hold more than one) rather than a single event's object, which is
 * the one way the cron's resolution legitimately differs from the
 * per-event webhook — and why they share `tierFromStripePriceIds` for
 * the price→tier mapping rather than duplicating it.
 */
export function resolveDesiredTierFromStripeSubscriptions(
  subs: ReconcilableSubscription[],
): UserTier {
  let best: UserTier = "free";
  for (const sub of subs) {
    if (!STRIPE_ENTITLING_STATUSES.has(sub.status)) continue;
    const priceIds = sub.items.data
      .map((item) => item.price?.id)
      .filter((id): id is string => Boolean(id));
    const tier = tierFromStripePriceIds(priceIds);
    if (tier === "pro") return "pro"; // highest sellable tier — short-circuit
    if (tier === "base" && tierRank("base") > tierRank(best)) best = "base";
  }
  return best;
}

export interface ReconcileSummary {
  ok: boolean;
  scanned: number;
  inSync: number;
  granted: number; // upgrade drift auto-corrected
  downgradeCandidates: number; // downgrade drift detected + alerted
  downgraded: number; // downgrade drift auto-applied (only when opted in)
  floorProtected: number; // lifetime_pro left untouched
  errors: number; // per-customer failures (isolated, batch continues)
  autoDowngrade: boolean;
  durationMs: number;
}

export interface ReconcileDeps {
  /** List a customer's subscriptions (all statuses), prices expanded. */
  listSubscriptions: (
    stripe: Stripe,
    customerId: string,
  ) => Promise<ReconcilableSubscription[]>;
  /** Persist a tier correction (defaults to the shared service-role writer). */
  writeTier?: (userId: string, tier: UserTier) => Promise<boolean>;
}

/** Default: page through the customer's subscriptions from the live Stripe API. */
async function listSubscriptionsLive(
  stripe: Stripe,
  customerId: string,
): Promise<ReconcilableSubscription[]> {
  const res = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 100,
    expand: ["data.items.data.price"],
  });
  return res.data as unknown as ReconcilableSubscription[];
}

interface ProfileRow {
  id: string;
  user_tier: string | null;
  stripe_customer_id: string | null;
}

/** Report a single drift event to Sentry (uuids only — no PII). */
function reportDrift(
  kind: "grant" | "downgrade_candidate" | "downgrade_applied",
  userId: string,
  from: string,
  to: UserTier,
): void {
  Sentry.captureMessage(`[entitlement-reconcile] ${kind} ${from} → ${to}`, {
    level: "warning",
    fingerprint: ["entitlement-reconcile", kind],
    tags: { type: "entitlement-reconcile", drift_kind: kind, rail: "stripe" },
    extra: {
      userId,
      fromTier: from,
      toTier: to,
      note:
        kind === "downgrade_candidate"
          ? "Stripe shows no entitling subscription but user_tier is higher. NOT auto-applied — user may be a legitimate App Store (RevenueCat) subscriber. Verify RC entitlement (or ENG-1463) before downgrading."
          : "A correction here means a payment webhook was missed or failed for this user — investigate the webhook delivery, not just the corrected tier.",
    },
  });
}

/**
 * Core reconciliation. Dependency-injected on the Supabase client, the
 * Stripe client, and IO adapters so tests run without a live DB / Stripe.
 *
 * Scans only Stripe-touched profiles (`stripe_customer_id IS NOT NULL`)
 * — the exact set whose tier could drift from Stripe truth — not the
 * whole table.
 */
export async function reconcileEntitlements(
  supabase: SupabaseClient,
  stripe: Stripe,
  deps: ReconcileDeps = { listSubscriptions: listSubscriptionsLive },
  opts: { autoDowngrade?: boolean } = {},
): Promise<ReconcileSummary> {
  const t0 = Date.now();
  const listSubscriptions = deps.listSubscriptions ?? listSubscriptionsLive;
  const writeTier = deps.writeTier ?? updateProfileTierServiceRole;
  const autoDowngrade =
    opts.autoDowngrade ??
    process.env.RECONCILE_STRIPE_AUTO_DOWNGRADE?.trim() === "true";

  const summary: ReconcileSummary = {
    ok: true,
    scanned: 0,
    inSync: 0,
    granted: 0,
    downgradeCandidates: 0,
    downgraded: 0,
    floorProtected: 0,
    errors: 0,
    autoDowngrade,
    durationMs: 0,
  };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_tier, stripe_customer_id")
    .not("stripe_customer_id", "is", null);

  if (error) {
    console.log(
      JSON.stringify({
        at: "cron.entitlement_reconcile",
        phase: "select_failed",
        error: error.message,
      }),
    );
    throw new Error(`entitlement_reconcile select failed: ${error.message}`);
  }

  const profiles = (data ?? []) as ProfileRow[];

  for (const profile of profiles) {
    const customerId = profile.stripe_customer_id;
    if (!customerId) continue; // defensive — the query already filters nulls
    summary.scanned += 1;
    const current = (profile.user_tier ?? "free") as string;

    // Founding comp is durable — never reconciled down (or up) by Stripe.
    if (current === "lifetime_pro") {
      summary.floorProtected += 1;
      continue;
    }

    try {
      const subs = await listSubscriptions(stripe, customerId);
      const desired = resolveDesiredTierFromStripeSubscriptions(subs);
      const currentRank = tierRank(current);
      const desiredRank = tierRank(desired);

      if (desiredRank === currentRank) {
        summary.inSync += 1;
        continue;
      }

      if (desiredRank > currentRank) {
        // Upgrade drift — paid but under-entitled. Always safe to correct.
        const ok = await writeTier(profile.id, desired);
        if (ok) {
          summary.granted += 1;
          reportDrift("grant", profile.id, current, desired);
        } else {
          summary.errors += 1;
        }
        continue;
      }

      // Downgrade drift — Stripe shows no entitling sub but user_tier is
      // higher. Risky to auto-apply (possible App Store subscriber).
      summary.downgradeCandidates += 1;
      reportDrift("downgrade_candidate", profile.id, current, desired);
      if (autoDowngrade) {
        const ok = await writeTier(profile.id, desired);
        if (ok) {
          summary.downgraded += 1;
          reportDrift("downgrade_applied", profile.id, current, desired);
        } else {
          summary.errors += 1;
        }
      }
    } catch (err) {
      // Isolate per-customer failures — one bad Stripe call (or a
      // deleted customer) must not abort the whole batch.
      summary.errors += 1;
      Sentry.captureException(err, {
        tags: { type: "entitlement-reconcile", phase: "per_customer" },
        extra: { userId: profile.id },
      });
    }
  }

  summary.durationMs = Date.now() - t0;
  console.log(
    JSON.stringify({
      at: "cron.entitlement_reconcile",
      phase: "complete",
      scanned: summary.scanned,
      inSync: summary.inSync,
      granted: summary.granted,
      downgradeCandidates: summary.downgradeCandidates,
      downgraded: summary.downgraded,
      floorProtected: summary.floorProtected,
      errors: summary.errors,
      autoDowngrade: summary.autoDowngrade,
      durationMs: summary.durationMs,
    }),
  );
  return summary;
}

/**
 * Full HTTP handler logic (auth gate + client resolution + run),
 * dependency-injected so the route file stays a thin wrapper.
 *
 * Note the deliberate difference from the other crons: when Stripe is
 * NOT configured (`getStripe()` → null, the pre-launch default), this
 * returns a clean 200 `skipped` rather than a 503. A 503 would trip the
 * `scheduled-crons.yml` failure-alerting (ENG-1400) and open a GitHub
 * issue every 6h until Grace runs the Stripe go-live bundle — false
 * alarms for a rail that is dark by design until then. A missing cron
 * secret or service-role key IS still a 503 (those are real
 * misconfigurations that should always page).
 */
export async function runEntitlementReconcileRoute(
  req: Request,
  getAdminClient: () => SupabaseClient | null,
  getStripe: () => Stripe | null,
  runner: typeof reconcileEntitlements = reconcileEntitlements,
): Promise<NextResponse> {
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

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_misconfigured",
        message: "SUPABASE_SERVICE_ROLE_KEY unset — cannot reconcile entitlements",
      },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    // Stripe rail not configured yet (pre-launch). Clean no-op, not a
    // failure — see the doc comment above.
    console.log(
      JSON.stringify({
        at: "cron.entitlement_reconcile",
        phase: "skipped",
        reason: "stripe_not_configured",
      }),
    );
    return NextResponse.json({ ok: true, skipped: "stripe_not_configured", scanned: 0 });
  }

  try {
    const summary = await runner(supabase, stripe);
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "reconcile_failed", message },
      { status: 502 },
    );
  }
}
