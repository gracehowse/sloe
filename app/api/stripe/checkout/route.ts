import { NextResponse } from "next/server";
import Stripe from "stripe";
import { rateLimit } from "@/lib/server/rateLimit";

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

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured", message: "Set STRIPE_SECRET_KEY on the server." },
      { status: 503 },
    );
  }

  let body: { tier?: string };
  try {
    body = (await req.json()) as { tier?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const tier = body.tier === "pro" ? "pro" : body.tier === "base" ? "base" : null;
  if (!tier) {
    return NextResponse.json({ ok: false, error: "invalid_tier" }, { status: 400 });
  }

  const priceId =
    tier === "pro"
      ? process.env.STRIPE_PRICE_PRO_MONTHLY?.trim()
      : process.env.STRIPE_PRICE_BASE_MONTHLY?.trim();

  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error: "stripe_prices_missing",
        message:
          tier === "pro"
            ? "Set STRIPE_PRICE_PRO_MONTHLY to your Stripe Price id."
            : "Set STRIPE_PRICE_BASE_MONTHLY to your Stripe Price id.",
      },
      { status: 503 },
    );
  }

  const origin = appOrigin();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
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
