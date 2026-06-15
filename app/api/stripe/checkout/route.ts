import { NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromAuthHeader } from "@/lib/supabase/serverAnonClient";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { detectRegion } from "@/lib/region/detectRegion";
import { resolveProStripePriceId } from "@/lib/stripe/resolveProStripePrice";

export const runtime = "nodejs";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

function appOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  // P0-6 (2026-04-25): authenticate first so the rate-limit bucket can be
  // scoped per-user. Pre-fix the bucket was IP-only with the auth check
  // running after — a shared NAT could starve all paying users on it,
  // and an attacker rotating IPs could bypass the cap entirely.
  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Sign in again, then retry checkout." },
      { status: 401 },
    );
  }

  const limited = await rateLimit({
    keyPrefix: "api:stripe-checkout",
    userId,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured", message: "Set STRIPE_SECRET_KEY on the server." },
      { status: 503 },
    );
  }

  let body: { tier?: string; period?: string; currency?: string };
  try {
    body = (await req.json()) as { tier?: string; period?: string; currency?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  // PR-01 (audit 2026-04-28): `tier: "base"` requests are now
  // rejected with 400 invalid_tier. Pro is the only sellable tier
  // post-strategic-direction collapse. The Stripe webhook handler
  // (`src/lib/stripe/webhookProcess.ts`) still recognises any
  // pre-existing Base price IDs so legacy events don't crash.
  const tier = body.tier === "pro" ? "pro" : null;
  if (!tier) {
    return NextResponse.json({ ok: false, error: "invalid_tier" }, { status: 400 });
  }

  // Default to monthly so older clients that don't send `period` keep
  // working on the monthly SKU. Annual is opt-in via the /pricing
  // toggle which passes the period explicitly.
  const period = body.period === "annual" ? "annual" : "monthly";

  const regionCurrency = detectRegion(req.headers).currency;
  const requestedCurrency =
    body.currency === "EUR" || body.currency === "GBP" ? body.currency : regionCurrency;

  const { priceId, envVar: priceEnvVar, currency: checkoutCurrency } = resolveProStripePriceId({
    period,
    currency: requestedCurrency,
  });

  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error: "stripe_prices_missing",
        message: `Set ${priceEnvVar} to your Stripe Price id.`,
      },
      { status: 503 },
    );
  }

  const origin = appOrigin();

  // Stripe Tax wiring is flag-gated (round-6, 2026-04-19). When the
  // dashboard has not yet activated Tax + set `tax_behavior` on each
  // Price, passing `automatic_tax.enabled: true` makes Stripe return
  // a 400 and the user sees a broken checkout. The flag lets the code
  // ship ahead of the dashboard flip; flipping `STRIPE_TAX_ENABLED=true`
  // in prod env is what activates the VAT-inclusive behaviour (copy on
  // /pricing also swaps on the same flag — keep them in lockstep).
  //
  // `customer_update: { address: "auto" }` is intentionally omitted —
  // Stripe errors if it's passed without an existing `customer` id,
  // and this route lets Checkout mint a fresh Customer via
  // `client_reference_id` rather than reusing one.
  const stripeTaxEnabled = process.env.STRIPE_TAX_ENABLED === "true";
  const taxFields = stripeTaxEnabled
    ? {
        automatic_tax: { enabled: true as const },
        billing_address_collection: "auto" as const,
      }
    : {};

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      metadata: {
        supabase_user_id: userId,
        tier,
        period,
        currency: checkoutCurrency,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
          tier,
          period,
          currency: checkoutCurrency,
        },
      },
      // Audit 2026-04-30 (user-sentiment pain #1): the success page is
      // a dedicated `/checkout/success` route that surfaces an explicit
      // trust-copy receipt (cancel path, trial-end, refund window,
      // support email) before bouncing the user back into the app.
      // Pre-audit this redirected silently to `/?checkout=success`
      // which `App.tsx` swallowed without confirmation — the pattern
      // every competitor on the 14-app sentiment list got dinged for.
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&period=${period}&tier=${tier}`,
      cancel_url: `${origin}/?checkout=cancel`,
      allow_promotion_codes: true,
      ...taxFields,
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, error: "no_checkout_url" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "checkout_failed";
    captureRouteError(e, "/api/stripe/checkout");
    return NextResponse.json({ ok: false, error: "stripe_error", message }, { status: 500 });
  }
}
