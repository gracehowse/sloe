import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getUserIdFromAuthHeader, createSupabaseServiceRoleClient } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import type {
  ManagedVia,
  SubscriptionStatus,
  SubscriptionSummary,
} from "@/lib/stripe/subscriptionCardView";

/**
 * `GET /api/stripe/subscription-status` (ENG-748 #11) — read-only
 * provider-authoritative subscription status for the web
 * subscription-management card.
 *
 * Architecture (monetisation-architect, 2026-05-27): we do NOT build
 * custom billing mutations — the Stripe Customer Portal (opened via
 * `/account/billing`) owns every state change. This route ONLY reads
 * the current state so the Settings card can describe it truthfully.
 *
 * Auth mirrors `app/api/stripe/checkout/route.ts` — Bearer token via
 * the Authorization header, resolved through the Supabase anon client.
 *
 * Returns a TYPED MINIMAL payload (legal P0): never the raw Stripe
 * customer object, never a full card number — only the brand + last4
 * and the provider-authoritative next-charge fields.
 *
 *   - profiles.stripe_customer_id present → retrieve the customer +
 *     its subscriptions, return managedVia:"stripe".
 *   - no customer id + tier pro          → managedVia:"app_store"
 *     (paid via RevenueCat / IAP; Apple owns billing).
 *   - no customer id + free              → managedVia:"none".
 *
 * Never cached — subscription state changes out-of-band (Stripe portal,
 * webhook, dunning) and a stale "renews on X" is a legal exposure.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

type SubscriptionStatusResponse = {
  ok: boolean;
  subscription: SubscriptionSummary | null;
  managedVia: ManagedVia;
  /** Surfaced from `STRIPE_TAX_ENABLED` so the client card knows
   *  whether the VAT-inclusive claim is truthful (legal P0 PX-2). */
  taxEnabled: boolean;
  error?: string;
};

function json(body: SubscriptionStatusResponse, status = 200): NextResponse {
  // Defence-in-depth: no caching of subscription state at any layer.
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/** Map a raw Stripe subscription status string to our render enum.
 *  Unknown values default to "active" (access is live; the cancel path
 *  is identical) rather than throwing. */
function normaliseStatus(raw: string): SubscriptionStatus {
  switch (raw) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return raw;
    default:
      return "active";
  }
}

function billingPeriodFromInterval(
  interval: string | undefined | null,
): "monthly" | "annual" | null {
  if (interval === "year") return "annual";
  if (interval === "month") return "monthly";
  return null;
}

/** Pick the subscription to describe: the first non-terminal one
 *  (active/trialing/past_due/unpaid), else the first returned. Most
 *  Suppr customers have exactly one. */
function pickSubscription(
  subs: Stripe.Subscription[],
): Stripe.Subscription | null {
  if (subs.length === 0) return null;
  const live = subs.find(
    (s) =>
      s.status === "active" ||
      s.status === "trialing" ||
      s.status === "past_due" ||
      s.status === "unpaid",
  );
  return live ?? subs[0];
}

function toSummary(sub: Stripe.Subscription): SubscriptionSummary {
  const item = sub.items?.data?.[0];
  const price = item?.price ?? null;
  const interval = price?.recurring?.interval ?? null;

  // Stripe's basil API (SDK 22.x) moved `current_period_end` from the
  // Subscription object onto each SubscriptionItem. Read it from the
  // first item — Suppr subscriptions have a single line item.
  const currentPeriodEnd =
    typeof item?.current_period_end === "number" ? item.current_period_end : null;

  // Default payment method may be expanded on the subscription. We only
  // ever expose brand + last4 — never the full PAN (legal P0).
  const pm = sub.default_payment_method;
  let brand: string | null = null;
  let last4: string | null = null;
  if (pm && typeof pm !== "string" && pm.card) {
    brand = pm.card.brand ?? null;
    last4 = pm.card.last4 ?? null;
  }

  return {
    status: normaliseStatus(sub.status),
    billingPeriod: billingPeriodFromInterval(interval),
    currentPeriodEnd,
    trialEnd: typeof sub.trial_end === "number" ? sub.trial_end : null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    priceAmount: typeof price?.unit_amount === "number" ? price.unit_amount : null,
    currency: price?.currency ?? sub.currency ?? null,
    paymentMethodBrand: brand,
    paymentMethodLast4: last4,
  };
}

export async function GET(req: Request) {
  const taxEnabled = process.env.STRIPE_TAX_ENABLED === "true";

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) {
    return json(
      { ok: false, subscription: null, managedVia: "none", taxEnabled, error: "unauthorized" },
      401,
    );
  }

  const admin = createSupabaseServiceRoleClient();
  if (!admin) {
    // Service role unset — we can't resolve the customer id. Report
    // managedVia:"none" so the card degrades gracefully rather than
    // claiming a billing rail it can't verify.
    captureRouteError(
      new Error("SUPABASE_SERVICE_ROLE_KEY unset"),
      "/api/stripe/subscription-status",
    );
    return json(
      { ok: false, subscription: null, managedVia: "none", taxEnabled, error: "service_role_unset" },
      503,
    );
  }

  const { data: profileRow, error: profileErr } = await admin
    .from("profiles")
    .select("stripe_customer_id, user_tier")
    .eq("id", userId)
    .maybeSingle();

  if (profileErr) {
    captureRouteError(profileErr, "/api/stripe/subscription-status", {
      stage: "profile_read",
    });
    return json(
      { ok: false, subscription: null, managedVia: "none", taxEnabled, error: "profile_read_failed" },
      500,
    );
  }

  const stripeCustomerId =
    (profileRow?.stripe_customer_id as string | null | undefined) ?? null;
  const tier = profileRow?.user_tier as string | null | undefined;
  const isPro = tier === "pro";

  // No Stripe customer id → split by tier. A Pro user without a Stripe
  // customer paid via App Store / RevenueCat — Apple owns billing
  // (legal P0 MV-1/MV-2). A non-Pro user has nothing to manage.
  if (!stripeCustomerId) {
    return json({
      ok: true,
      subscription: null,
      managedVia: isPro ? "app_store" : "none",
      taxEnabled,
    });
  }

  const stripe = getStripe();
  if (!stripe) {
    // Customer id exists but Stripe isn't configured server-side. We
    // know they're a Stripe-rail customer; the card surfaces the
    // billing-portal fallback. Report stripe rail with a null sub.
    return json({
      ok: false,
      subscription: null,
      managedVia: "stripe",
      taxEnabled,
      error: "stripe_not_configured",
    });
  }

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId, {
      expand: ["subscriptions", "subscriptions.data.default_payment_method"],
    });

    // A deleted customer comes back as `{ deleted: true }`.
    if (!customer || customer.deleted) {
      return json({
        ok: true,
        subscription: null,
        managedVia: "stripe",
        taxEnabled,
      });
    }

    const subs = customer.subscriptions?.data ?? [];
    const chosen = pickSubscription(subs);

    return json({
      ok: true,
      subscription: chosen ? toSummary(chosen) : null,
      managedVia: "stripe",
      taxEnabled,
    });
  } catch (e) {
    captureRouteError(e, "/api/stripe/subscription-status", { stage: "stripe_retrieve" });
    const message = e instanceof Error ? e.message : "stripe_error";
    return json(
      { ok: false, subscription: null, managedVia: "stripe", taxEnabled, error: message },
      500,
    );
  }
}
