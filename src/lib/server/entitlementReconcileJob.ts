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
 * ## Architecture — one paginated Stripe-wide sweep, not one call per user
 *
 * (ENG-1463, 2026-07-15 revision.) The original v1 design scanned
 * `profiles` for `stripe_customer_id IS NOT NULL` and made one
 * `stripe.subscriptions.list({customer: id})` round-trip PER matching
 * profile. That has two structural bugs a review surfaced:
 *
 *   1. **Blind to the exact failure it exists to heal.** The ONLY writer
 *      of `stripe_customer_id` is the `checkout.session.completed`
 *      webhook handler. If that specific event is the one permanently
 *      missed (the module's own "most likely launch failure" scenario),
 *      the customer's `stripe_customer_id` is NULL — so the old scan
 *      never saw them at all. Scanning `profiles` first meant the job
 *      could only heal drift for customers whose FIRST webhook already
 *      succeeded.
 *   2. **A hard scale wall.** One sequential Stripe round-trip per
 *      profile (~150–300ms) crosses the GitHub Actions invoker's 120s
 *      `curl --max-time` at a few hundred Stripe-touched profiles —
 *      well within reach at real launch scale, at which point every
 *      invocation attempt fails and retries pile up (see
 *      `.github/workflows/scheduled-crons.yml`).
 *
 * The fix: page through Stripe's OWN subscription list ONCE per run
 * (`listAllStripeSubscriptionsLive`, `status: "all"`, 100/page), tagging
 * each subscription with its Stripe customer id AND — when present —
 * `metadata.supabase_user_id` (the same field `checkout/route.ts` sets on
 * `subscription_data.metadata` and the webhook already reads via
 * `resolveUserIdFromSubscription`). This sweep is grouped two ways:
 *
 *   - **by customer id** — resolves drift for every profile that already
 *     has `stripe_customer_id` set, with ZERO additional Stripe calls
 *     (the sweep already fetched it). Fixes the scale wall.
 *   - **by `supabase_user_id` metadata** — discovers users Stripe knows
 *     about that `profiles.stripe_customer_id` does NOT (the checkout
 *     webhook was missed but the customer/subscription still carries the
 *     user-identifying metadata Stripe attaches at creation time). Fixes
 *     the blind spot, and backfills `stripe_customer_id` once discovered
 *     so `/account/billing`'s Customer Portal keeps working.
 *
 * Total Stripe API cost is now O(live subscriptions / 100), not
 * O(Suppr profiles) — a large win at any scale beyond a handful of
 * customers, and a page-count safety cap (`MAX_SWEEP_PAGES`) fires a
 * loud Sentry error rather than silently truncating if it's ever
 * approached (see the constant's comment for the follow-up path if
 * launch-scale subscription VOLUME — not user count — ever gets there).
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
 *     true` opts in early (e.g. if the product stays web-only). A
 *     per-run circuit breaker (`MAX_AUTO_DOWNGRADES_PER_RUN`) caps how
 *     many downgrades that opt-in can auto-apply in one run, so a price
 *     misconfiguration can't mass-revoke paying customers unattended.
 *
 *   - **Indeterminate** (Stripe shows an ENTITLING-status subscription
 *     but its price id matches none of the configured `STRIPE_PRICE_*`
 *     env vars — e.g. a price rotation or an unconfigured currency
 *     variant): this is NOT treated as a downgrade signal. Mirrors
 *     `tierDecisionForSubscription`'s webhook-side "skip" — never a
 *     spurious grant, and (the fix here) never a spurious downgrade
 *     either. Reported in aggregate, not per-user, to avoid a misconfig
 *     alert flood burying genuine cancellation drift.
 *
 * `lifetime_pro` is never touched (founding comp is durable — mirrors
 * `updateProfileTierServiceRole`'s own floor-protection, belt and
 * braces).
 *
 * ## Concurrency with the webhooks (TOCTOU)
 *
 * Between this job reading a profile's `user_tier` and writing a
 * correction, a webhook could land and change it first. Immediately
 * before any write, the job re-reads the row and aborts that single
 * write (not the whole run) if the tier no longer matches what the
 * decision was based on — the webhook's fresher write wins, and the
 * cron simply re-evaluates next cycle.
 *
 * ## Auditability
 *
 * One structured `at: "cron.entitlement_reconcile"` summary line per run
 * (counts only, no PII). Per-user drift is reported to Sentry (uuids
 * only) so a correction pages someone, matching the alerting bar of the
 * other scheduled crons (`supabaseAdvisorCheck.ts`). A run is only
 * reported `ok: true` (HTTP 200) when it didn't fail systemically — see
 * `ReconcileSummary.ok`.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import type { UserTier } from "@/types/recipe";
import { tierRank } from "@/lib/tier/tierRank";
import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";
import {
  tierDecisionForSubscription,
  type TierDecidableSubscription,
} from "@/lib/stripe/webhookProcess";

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

/** Minimal shape this job reads off a Stripe subscription (keeps the fake in tests small). */
export type ReconcilableSubscription = TierDecidableSubscription;

/** One subscription from the global sweep, tagged with routing keys. */
export interface RawStripeSubscriptionRecord extends ReconcilableSubscription {
  customerId: string;
  /** `metadata.supabase_user_id` when present and UUID-shaped, else null. */
  supabaseUserId: string | null;
}

export interface DesiredTierResolution {
  tier: UserTier;
  /** True when the resolved "free" is uncertain — at least one entitling
   *  subscription had no recognised price (misconfig / rotation) and no
   *  OTHER subscription actually granted a tier. Always false when the
   *  resolved tier is "base" or "pro" (a real grant already overrides
   *  any ambiguity). */
  indeterminate: boolean;
}

/**
 * The tier a customer SHOULD hold given their full set of Stripe
 * subscriptions: the highest tier across every *entitling* subscription,
 * or `"free"` if none entitle. Considers all subscriptions (a customer
 * can hold more than one) rather than a single event's object, which is
 * the one way the cron's resolution legitimately differs from the
 * per-event webhook.
 *
 * Delegates the per-subscription status→tier policy to
 * `tierDecisionForSubscription` (shared with the webhook) instead of
 * re-encoding it — the two callers cannot independently drift.
 */
export function resolveDesiredTierFromStripeSubscriptions(
  subs: ReconcilableSubscription[],
): DesiredTierResolution {
  let best: UserTier = "free";
  let sawIndeterminate = false;
  for (const sub of subs) {
    const decision = tierDecisionForSubscription(sub);
    if (decision.action === "grant") {
      if (decision.tier === "pro") return { tier: "pro", indeterminate: false }; // highest sellable tier — short-circuit
      if (tierRank(decision.tier) > tierRank(best)) best = decision.tier;
    } else if (decision.action === "skip") {
      sawIndeterminate = true;
    }
    // "free" action contributes nothing — a terminal-status subscription.
  }
  return { tier: best, indeterminate: best === "free" && sawIndeterminate };
}

export interface ReconcileSummary {
  /** False only on a systemic failure (every scanned customer errored) —
   *  drives the route's HTTP status so the ENG-1400 cron-failure alerting
   *  actually fires on real breakage, not on a handful of per-customer
   *  blips among many successes. */
  ok: boolean;
  scanned: number;
  inSync: number;
  granted: number; // upgrade drift auto-corrected
  downgradeCandidates: number; // downgrade drift detected + alerted
  downgraded: number; // downgrade drift auto-applied (only when opted in)
  downgradesSkippedByCircuitBreaker: number; // would-be auto-downgrades held back this run
  indeterminate: number; // entitling sub, unrecognised price — never acted on
  floorProtected: number; // lifetime_pro left untouched
  customerIdBackfilled: number; // discovered via Stripe metadata, persisted
  staleWriteSkipped: number; // a webhook wrote a fresher value between read and write
  noProfile: number; // Stripe metadata referenced a user id with no profile row
  errors: number; // per-customer failures (isolated, batch continues)
  autoDowngrade: boolean;
  sweepPages: number;
  sweepTruncated: boolean;
  durationMs: number;
}

export interface ReconcileDeps {
  /** Page through EVERY Stripe subscription once (any status), tagged
   *  with customer id + (if present) `metadata.supabase_user_id`. */
  listAllSubscriptions: (
    stripe: Stripe,
  ) => Promise<{ records: RawStripeSubscriptionRecord[]; truncated: boolean; pages: number }>;
  /** Persist a tier correction (defaults to the shared service-role writer). */
  writeTier?: (userId: string, tier: UserTier) => Promise<boolean>;
  /** Backfill `profiles.stripe_customer_id` once discovered via Stripe
   *  metadata (defaults to a real Supabase update against the admin
   *  client already passed into `reconcileEntitlements`). */
  backfillCustomerId?: (userId: string, customerId: string) => Promise<boolean>;
}

/** UUID check for `metadata.supabase_user_id` — Stripe metadata is
 *  free-text; only trust it when it's actually UUID-shaped (mirrors
 *  `isUuid` in `webhookProcess.ts`). */
function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Safety cap on the global sweep's page count (100 subs/page). 500 pages
 * = 50,000 live Stripe subscription objects in one run — generous
 * headroom over any realistic near-term scale. Hitting it fires a loud
 * Sentry error (`sweepTruncated`) rather than silently reconciling a
 * partial view; the follow-up if launch subscription VOLUME (not user
 * count) ever approaches it is to add a `created`-date floor or page
 * per-status in parallel, not to raise this cap blindly.
 */
const MAX_SWEEP_PAGES = 500;

/** Default: page through every Stripe subscription from the live API. */
async function listAllStripeSubscriptionsLive(
  stripe: Stripe,
): Promise<{ records: RawStripeSubscriptionRecord[]; truncated: boolean; pages: number }> {
  const records: RawStripeSubscriptionRecord[] = [];
  let startingAfter: string | undefined;
  let pages = 0;
  for (;;) {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.items.data.price"],
    });
    pages += 1;
    for (const sub of page.data) {
      const meta = sub.metadata?.supabase_user_id?.trim();
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      records.push({
        status: sub.status,
        items: sub.items as unknown as ReconcilableSubscription["items"],
        customerId,
        supabaseUserId: meta && isUuidLike(meta) ? meta : null,
      });
    }
    if (!page.has_more || page.data.length === 0) break;
    if (pages >= MAX_SWEEP_PAGES) {
      return { records, truncated: true, pages };
    }
    startingAfter = page.data[page.data.length - 1].id;
  }
  return { records, truncated: false, pages };
}

function groupSweepByCustomer(
  records: RawStripeSubscriptionRecord[],
): Map<string, ReconcilableSubscription[]> {
  const map = new Map<string, ReconcilableSubscription[]>();
  for (const r of records) {
    const list = map.get(r.customerId);
    const entry: ReconcilableSubscription = { status: r.status, items: r.items };
    if (list) list.push(entry);
    else map.set(r.customerId, [entry]);
  }
  return map;
}

/**
 * Groups by `metadata.supabase_user_id`, picking which Stripe customer id
 * to backfill onto the profile when a user has subscriptions under more
 * than one Stripe Customer (churn-and-resubscribe mints a fresh Customer
 * per checkout — see `checkout/route.ts`'s "no `customer` param" comment).
 * An ENTITLING subscription's customer id always wins over one from a
 * terminal-status subscription, so a stale/canceled customer id can never
 * overwrite the live one — the tier resolution is already correct either
 * way (it considers every sub regardless of which customer id backs it),
 * this only affects which id `/account/billing` gets to open the Customer
 * Portal against.
 */
function groupSweepBySupabaseUser(
  records: RawStripeSubscriptionRecord[],
): Map<string, { subs: ReconcilableSubscription[]; customerId: string }> {
  const map = new Map<
    string,
    { subs: ReconcilableSubscription[]; customerId: string; customerIdIsEntitling: boolean }
  >();
  for (const r of records) {
    if (!r.supabaseUserId) continue;
    const sub: ReconcilableSubscription = { status: r.status, items: r.items };
    const isEntitling = tierDecisionForSubscription(sub).action === "grant";
    const entry = map.get(r.supabaseUserId);
    if (!entry) {
      map.set(r.supabaseUserId, { subs: [sub], customerId: r.customerId, customerIdIsEntitling: isEntitling });
      continue;
    }
    entry.subs.push(sub);
    if (isEntitling && !entry.customerIdIsEntitling) {
      entry.customerId = r.customerId;
      entry.customerIdIsEntitling = true;
    }
  }
  const out = new Map<string, { subs: ReconcilableSubscription[]; customerId: string }>();
  for (const [userId, entry] of map) {
    out.set(userId, { subs: entry.subs, customerId: entry.customerId });
  }
  return out;
}

interface ProfileRow {
  id: string;
  user_tier: string | null;
  stripe_customer_id: string | null;
}

/** Page through `profiles` where `stripe_customer_id IS NOT NULL`, ordered
 *  by `id` for a stable cursor — PostgREST's `max_rows` cap (1000 by
 *  default; `supabase/config.toml` pins the same) otherwise silently
 *  truncates an unpaginated select past that many rows. */
async function fetchKnownCustomerProfiles(
  supabase: SupabaseClient,
  pageSize = 1000,
): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_tier, stripe_customer_id")
      .not("stripe_customer_id", "is", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
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
    const page = (data ?? []) as ProfileRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/** Fetch profiles by id in bounded chunks (avoids an oversized `.in()` and
 *  keeps every response well under the PostgREST row cap). Used for the
 *  "orphan" set: Stripe knows this user via metadata, `profiles` doesn't
 *  yet carry their `stripe_customer_id`. */
async function fetchProfilesByIds(
  supabase: SupabaseClient,
  ids: string[],
  chunkSize = 200,
): Promise<ProfileRow[]> {
  const rows: ProfileRow[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_tier, stripe_customer_id")
      .in("id", chunk);
    if (error) {
      console.log(
        JSON.stringify({
          at: "cron.entitlement_reconcile",
          phase: "orphan_select_failed",
          error: error.message,
        }),
      );
      throw new Error(`entitlement_reconcile orphan select failed: ${error.message}`);
    }
    rows.push(...((data ?? []) as ProfileRow[]));
  }
  return rows;
}

/** Immediately before a write, re-read the row to detect a fresher
 *  concurrent webhook write (TOCTOU guard). Returns the current tier, or
 *  null on read failure (treated as "don't write" by the caller — safer
 *  to skip a correction for one cycle than write over unknown state). */
async function readCurrentTier(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_tier")
    .eq("id", userId)
    .maybeSingle();
  if (error) return null;
  return (data?.user_tier as string | null | undefined) ?? "free";
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

/** A tier write silently returned false (no throw) — this is otherwise
 *  invisible: only a counter increments and the run still reports
 *  `ok: true`/200. Fire a real alert so a systemic write failure (e.g. a
 *  future DB-side lockdown that rejects the service-role UPDATE too)
 *  doesn't heal nothing while reporting green forever. */
function reportWriteFailed(userId: string, attemptedTier: UserTier): void {
  Sentry.captureMessage(`[entitlement-reconcile] tier write failed (no throw)`, {
    level: "warning",
    fingerprint: ["entitlement-reconcile", "write_failed"],
    tags: { type: "entitlement-reconcile", phase: "write_failed" },
    extra: { userId, attemptedTier },
  });
}

/** Per-run cap on AUTO-APPLIED downgrades (only relevant when
 *  `RECONCILE_STRIPE_AUTO_DOWNGRADE=true`). A price-id misconfiguration
 *  or rotation can otherwise turn every affected paying customer into an
 *  unattended downgrade in one run; past this many, remaining candidates
 *  are still detected + alerted, just not auto-applied. */
const MAX_AUTO_DOWNGRADES_PER_RUN = 20;

/**
 * Core reconciliation. Dependency-injected on the Supabase client, the
 * Stripe client, and IO adapters so tests run without a live DB / Stripe.
 *
 * See the module doc comment for the two-source (known-customer +
 * metadata-discovered-orphan) architecture this scans.
 */
export async function reconcileEntitlements(
  supabase: SupabaseClient,
  stripe: Stripe,
  deps: ReconcileDeps = { listAllSubscriptions: listAllStripeSubscriptionsLive },
  opts: { autoDowngrade?: boolean } = {},
): Promise<ReconcileSummary> {
  const t0 = Date.now();
  const listAllSubscriptions = deps.listAllSubscriptions ?? listAllStripeSubscriptionsLive;
  const writeTier = deps.writeTier ?? updateProfileTierServiceRole;
  const backfillCustomerId =
    deps.backfillCustomerId ??
    (async (userId: string, customerId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
      return !error;
    });
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
    downgradesSkippedByCircuitBreaker: 0,
    indeterminate: 0,
    floorProtected: 0,
    customerIdBackfilled: 0,
    staleWriteSkipped: 0,
    noProfile: 0,
    errors: 0,
    autoDowngrade,
    sweepPages: 0,
    sweepTruncated: false,
    durationMs: 0,
  };

  const sweep = await listAllSubscriptions(stripe);
  summary.sweepPages = sweep.pages;
  summary.sweepTruncated = sweep.truncated;
  if (sweep.truncated) {
    Sentry.captureMessage(
      `[entitlement-reconcile] Stripe sweep truncated at ${MAX_SWEEP_PAGES} pages — this run's coverage is partial`,
      { level: "error", fingerprint: ["entitlement-reconcile", "sweep_truncated"] },
    );
  }

  const byCustomer = groupSweepByCustomer(sweep.records);
  const byUser = groupSweepBySupabaseUser(sweep.records);

  const knownProfiles = await fetchKnownCustomerProfiles(supabase);
  const knownIds = new Set(knownProfiles.map((p) => p.id));
  const orphanIds = [...byUser.keys()].filter((id) => !knownIds.has(id));
  const orphanProfiles = orphanIds.length > 0 ? await fetchProfilesByIds(supabase, orphanIds) : [];

  const profiles = [...knownProfiles, ...orphanProfiles];

  for (const profile of profiles) {
    const current = (profile.user_tier ?? "free") as string;

    // Founding comp is durable — never reconciled down (or up) by Stripe.
    if (current === "lifetime_pro") {
      summary.floorProtected += 1;
      continue;
    }

    try {
      const fromCustomer = profile.stripe_customer_id
        ? byCustomer.get(profile.stripe_customer_id)
        : undefined;
      const fromMetadata = byUser.get(profile.id);
      const subs = [...(fromCustomer ?? []), ...(fromMetadata?.subs ?? [])];

      summary.scanned += 1;

      // Discovered via metadata but `profiles` doesn't have the customer
      // id yet (the checkout webhook that would normally persist it was
      // missed) — backfill regardless of tier outcome so
      // `/account/billing`'s Customer Portal keeps working.
      if (!profile.stripe_customer_id && fromMetadata) {
        const ok = await backfillCustomerId(profile.id, fromMetadata.customerId);
        if (ok) summary.customerIdBackfilled += 1;
      }

      const desired = resolveDesiredTierFromStripeSubscriptions(subs);
      const currentRank = tierRank(current);
      const desiredRank = tierRank(desired.tier);

      if (desiredRank === currentRank) {
        summary.inSync += 1;
        continue;
      }

      if (desired.indeterminate) {
        // Entitling subscription, unrecognised price (rotation / missing
        // env var) — mirrors the webhook's "skip": never act on this,
        // report once in aggregate rather than per-user.
        summary.indeterminate += 1;
        continue;
      }

      if (desiredRank > currentRank) {
        // Upgrade drift — paid but under-entitled. Always safe to correct.
        const freshTier = await readCurrentTier(supabase, profile.id);
        // A read failure (null) must ALSO abort the write — we have no
        // basis to confirm the decision still holds, and writing blind
        // over an unreadable row is worse than skipping one cycle.
        if (freshTier === null || freshTier !== current) {
          summary.staleWriteSkipped += 1;
          continue;
        }
        const ok = await writeTier(profile.id, desired.tier);
        if (ok) {
          summary.granted += 1;
          reportDrift("grant", profile.id, current, desired.tier);
        } else {
          summary.errors += 1;
          reportWriteFailed(profile.id, desired.tier);
        }
        continue;
      }

      // Downgrade drift — Stripe shows no entitling sub but user_tier is
      // higher. Risky to auto-apply (possible App Store subscriber).
      summary.downgradeCandidates += 1;
      reportDrift("downgrade_candidate", profile.id, current, desired.tier);
      if (autoDowngrade) {
        if (summary.downgraded >= MAX_AUTO_DOWNGRADES_PER_RUN) {
          summary.downgradesSkippedByCircuitBreaker += 1;
          continue;
        }
        const freshTier = await readCurrentTier(supabase, profile.id);
        // A read failure (null) must ALSO abort the write — we have no
        // basis to confirm the decision still holds, and writing blind
        // over an unreadable row is worse than skipping one cycle.
        if (freshTier === null || freshTier !== current) {
          summary.staleWriteSkipped += 1;
          continue;
        }
        const ok = await writeTier(profile.id, desired.tier);
        if (ok) {
          summary.downgraded += 1;
          reportDrift("downgrade_applied", profile.id, current, desired.tier);
        } else {
          summary.errors += 1;
          reportWriteFailed(profile.id, desired.tier);
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

  // Users the sweep attributed via metadata but with no matching profile
  // row at all (deleted account, or a stray/incorrect metadata value).
  summary.noProfile = orphanIds.length - orphanProfiles.length;

  if (summary.downgradesSkippedByCircuitBreaker > 0) {
    Sentry.captureMessage(
      `[entitlement-reconcile] auto-downgrade circuit breaker tripped — ${summary.downgradesSkippedByCircuitBreaker} candidate(s) held back this run`,
      { level: "error", fingerprint: ["entitlement-reconcile", "downgrade_circuit_breaker"] },
    );
  }
  if (summary.indeterminate > 0) {
    Sentry.captureMessage(
      `[entitlement-reconcile] ${summary.indeterminate} customer(s) had an entitling Stripe subscription on an unrecognised price id — check STRIPE_PRICE_* env vars for a rotation/gap`,
      { level: "warning", fingerprint: ["entitlement-reconcile", "indeterminate_price"] },
    );
  }

  // Systemic failure only — every scanned customer errored. A handful of
  // per-customer blips among many successes stays a 200 so the ENG-1400
  // alerting doesn't page on noise, but a total failure must not report
  // green (this run reconciled nothing).
  summary.ok = !(summary.scanned > 0 && summary.errors === summary.scanned);

  summary.durationMs = Date.now() - t0;
  console.log(
    JSON.stringify({
      at: "cron.entitlement_reconcile",
      phase: "complete",
      ok: summary.ok,
      scanned: summary.scanned,
      inSync: summary.inSync,
      granted: summary.granted,
      downgradeCandidates: summary.downgradeCandidates,
      downgraded: summary.downgraded,
      downgradesSkippedByCircuitBreaker: summary.downgradesSkippedByCircuitBreaker,
      indeterminate: summary.indeterminate,
      floorProtected: summary.floorProtected,
      customerIdBackfilled: summary.customerIdBackfilled,
      staleWriteSkipped: summary.staleWriteSkipped,
      noProfile: summary.noProfile,
      errors: summary.errors,
      autoDowngrade: summary.autoDowngrade,
      sweepPages: summary.sweepPages,
      sweepTruncated: summary.sweepTruncated,
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
    return NextResponse.json(summary, { status: summary.ok ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "reconcile_failed", message },
      { status: 502 },
    );
  }
}
