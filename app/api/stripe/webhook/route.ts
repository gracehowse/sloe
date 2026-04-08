import { NextResponse } from "next/server";
import Stripe from "stripe";
import { processStripeWebhookEvent } from "@/lib/stripe/webhookProcess";
import { supabasePublicUrl } from "@/lib/supabase/serverAnonClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !whSecret) {
    return NextResponse.json(
      { ok: false, error: "stripe_webhook_not_configured", message: "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
      { status: 503 },
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, error: "supabase_service_role_missing", message: "Set SUPABASE_SERVICE_ROLE_KEY for tier updates." },
      { status: 503 },
    );
  }

  // Sanity: URL must match service role project
  void supabasePublicUrl();

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  try {
    await processStripeWebhookEvent(stripe, event);
  } catch (e) {
    const message = e instanceof Error ? e.message : "webhook_handler_error";
    console.error("stripe_webhook_handler", message);
    return NextResponse.json({ ok: false, error: "handler_failed", message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
