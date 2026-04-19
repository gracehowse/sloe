import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Stripe from "stripe";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import { createSupabaseServiceRoleClient } from "../../../src/lib/supabase/serverAnonClient.ts";
import { resolveBillingPortalOutcome } from "../../../src/lib/stripe/billingPortalDecision.ts";

/**
 * `/account/billing` — opens the Stripe Customer Portal for the signed-in
 * user, or degrades to a static support-email fallback when any piece of
 * the Stripe wiring isn't available.
 *
 * The decision logic lives in `src/lib/stripe/billingPortalDecision.ts`
 * (pure + unit-tested); this shell wires the Next.js-specific parts
 * (Supabase SSR cookies, Stripe SDK, `redirect()` side effects).
 *
 * Never 404s. Never crashes. Priority order (monetisation-architect
 * spec, 2026-04-19 round 3):
 *   1. Unauthenticated           → redirect `/login?redirect=/account/billing`
 *   2. No `stripe_customer_id`   → redirect `/pricing?ref=billing`
 *   3. `STRIPE_SECRET_KEY` unset → static support-email fallback
 *   4. Stripe API error          → static support-email fallback
 *   5. Happy path                → redirect to the Stripe portal URL
 *
 * Runs on the Node.js runtime (not Edge) because the Stripe SDK
 * depends on Node's `crypto`.
 */
export const runtime = "nodejs";
// Force dynamic rendering — this page never caches (it redirects per
// request to a single-use Stripe portal URL that expires quickly).
export const dynamic = "force-dynamic";

function appOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://localhost:3000";
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

/**
 * Static fallback shown when Stripe is unavailable (unset key, API
 * error). Copy pending legal-reviewer sign-off — kept deliberately
 * plain so a user who hits this path still gets an actionable next
 * step (email support). See the round-3 ship report for the
 * legal-reviewer handoff.
 */
function BillingUnavailableFallback() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          Manage your billing
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Manage your billing by emailing{" "}
          <a
            href="mailto:support@suppr-club.com"
            className="text-violet-600 dark:text-violet-400 underline underline-offset-2"
          >
            support@suppr-club.com
          </a>
          . We&apos;ll reply within one business day.
        </p>
      </div>
    </div>
  );
}

export default async function AccountBillingPage() {
  // 1. Authenticate via the Supabase SSR cookie reader — same pattern
  //    `app/page.tsx` uses. Unauthenticated users get the login
  //    redirect from `resolveBillingPortalOutcome`.
  const cookieStore = await cookies();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    `https://${projectId}.supabase.co`;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || publicAnonKey;
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // no-op — middleware owns cookie writes; server component only reads
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. Look up the Stripe customer id via the service-role client so
  //    RLS doesn't hide the row. Only executed when the user is
  //    authenticated — the outcome helper handles the unauth path.
  let stripeCustomerId: string | null = null;
  if (user) {
    const admin = createSupabaseServiceRoleClient();
    if (!admin) {
      // Service role unset — not the user's problem, but we can't
      // resolve the customer id. Fall through to the fallback by
      // leaving stripeCustomerId null AND skipping Stripe (handled
      // below by passing a null opener).
      console.warn(
        "[account/billing] SUPABASE_SERVICE_ROLE_KEY unset — showing fallback",
      );
      return <BillingUnavailableFallback />;
    }
    const { data: profileRow, error: profileErr } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr) {
      console.warn(
        "[account/billing] profile read failed:",
        profileErr.message,
      );
      return <BillingUnavailableFallback />;
    }
    stripeCustomerId =
      (profileRow?.stripe_customer_id as string | null | undefined) ?? null;
  }

  // 3. Build the portal opener — `null` when STRIPE_SECRET_KEY is unset.
  const stripe = getStripe();
  const openPortal =
    stripe && stripeCustomerId
      ? () =>
          stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${appOrigin()}/`,
          })
      : null;

  // 4. Let the pure decision helper pick the outcome.
  const outcome = await resolveBillingPortalOutcome({
    userId: user?.id ?? null,
    stripeCustomerId,
    openPortal,
  });

  if (outcome.kind === "redirect") {
    redirect(outcome.url);
  }

  console.warn(`[account/billing] fallback — ${outcome.reason}`);
  return <BillingUnavailableFallback />;
}
