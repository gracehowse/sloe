import { NextResponse } from "next/server";
import Stripe from "stripe";
import { tierFromStripePriceIds } from "@/lib/stripe/tierFromPrice";
import { updateProfileTierServiceRole } from "@/lib/stripe/updateProfileTier";
import { supabasePublicUrl } from "@/lib/supabase/serverAnonClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function resolveUserIdFromCheckoutSession(session: Stripe.Checkout.Session): string | null {
  const ref = session.client_reference_id?.trim();
  if (ref && isUuid(ref)) return ref;
  const meta = session.metadata?.supabase_user_id?.trim();
  if (meta && isUuid(meta)) return meta;
  return null;
}

function resolveUserIdFromSubscription(sub: Stripe.Subscription): string | null {
  const meta = sub.metadata?.supabase_user_id?.trim();
  if (meta && isUuid(meta)) return meta;
  return null;
}

function priceIdsFromSubscription(sub: Stripe.Subscription): string[] {
  return sub.items.data.map((item) => item.price?.id).filter((x): x is string => Boolean(x));
}

async function applyTierForSubscription(sub: Stripe.Subscription): Promise<void> {
  const userId = resolveUserIdFromSubscription(sub);
  if (!userId) return;

  const status = sub.status;
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    await updateProfileTierServiceRole(userId, "free");
    return;
  }

  if (status === "active" || status === "trialing" || status === "paused") {
    const ids = priceIdsFromSubscription(sub);
    const tier = tierFromStripePriceIds(ids);
    if (tier) {
      await updateProfileTierServiceRole(userId, tier);
    }
    return;
  }

  if (status === "past_due") {
    const ids = priceIdsFromSubscription(sub);
    const tier = tierFromStripePriceIds(ids);
    if (tier) {
      await updateProfileTierServiceRole(userId, tier);
    }
  }
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const userId = resolveUserIdFromCheckoutSession(session);
        if (!userId) break;
        const subRef = session.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
        const ids = priceIdsFromSubscription(sub);
        const tier = tierFromStripePriceIds(ids);
        if (tier) {
          await updateProfileTierServiceRole(userId, tier);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await applyTierForSubscription(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = resolveUserIdFromSubscription(sub);
        if (userId) {
          await updateProfileTierServiceRole(userId, "free");
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "webhook_handler_error";
    console.error("stripe_webhook_handler", message);
    return NextResponse.json({ ok: false, error: "handler_failed", message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
