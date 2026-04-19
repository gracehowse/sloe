import { NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromAuthHeader } from "@/lib/supabase/serverAnonClient";

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
  const limited = await rateLimit({ keyPrefix: "stripe_checkout", limit: 10, windowMs: 60_000 });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const userId = await getUserIdFromAuthHeader(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Sign in again, then retry checkout." },
      { status: 401 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured", message: "Set STRIPE_SECRET_KEY on the server." },
      { status: 503 },
    );
  }

  let body: { tier?: string; period?: string };
  try {
    body = (await req.json()) as { tier?: string; period?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const tier = body.tier === "pro" ? "pro" : body.tier === "base" ? "base" : null;
  if (!tier) {
    return NextResponse.json({ ok: false, error: "invalid_tier" }, { status: 400 });
  }

  // Default to monthly so older clients that don't send `period` keep
  // working on the monthly SKU. Annual is opt-in via the /pricing
  // toggle which passes the period explicitly.
  const period = body.period === "annual" ? "annual" : "monthly";

  const priceEnvVar =
    tier === "pro"
      ? period === "annual"
        ? "STRIPE_PRICE_PRO_ANNUAL"
        : "STRIPE_PRICE_PRO_MONTHLY"
      : period === "annual"
        ? "STRIPE_PRICE_BASE_ANNUAL"
        : "STRIPE_PRICE_BASE_MONTHLY";

  const priceId = process.env[priceEnvVar]?.trim();

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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      metadata: { supabase_user_id: userId, tier, period },
      subscription_data: {
        metadata: { supabase_user_id: userId, tier, period },
      },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancel`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json({ ok: false, error: "no_checkout_url" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "checkout_failed";
    return NextResponse.json({ ok: false, error: "stripe_error", message }, { status: 500 });
  }
}
