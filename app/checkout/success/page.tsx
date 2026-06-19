import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { buildReceiptTrustCopy } from "../../../src/lib/landing/paywallTrust.ts";
import { SupprWordmark } from "../../../src/app/components/ui/suppr-mark.tsx";

/**
 * `/checkout/success` — explicit, trust-explicit confirmation surface
 * after a successful Stripe Checkout session.
 *
 * Audit 2026-04-30 (user-sentiment pain #1, 14-app competitor scan):
 * billing trauma is the #1 most-cited pain across the entire category.
 * Cal AI hides price until end of onboarding then surprise-charges.
 * Lifesum's "subscription billed via website not iTunes" is a
 * cancellation-hell pattern. Lose It auto-renews at $39.99
 * immediately after trial.
 *
 * Suppr's counter is honest billing surfaced LOUDLY at the moment of
 * commitment: cancel path first, trial-end second, refund window
 * third, support email last (as a fallback, never a gate).
 *
 * Pre-audit the Stripe success_url redirected to `/?checkout=success`
 * which `src/app/App.tsx` silently consumed and routed to Today —
 * the user never saw confirmation, let alone the cancel path. This
 * page now sits in between, owned by SSOT copy at
 * `src/lib/landing/paywallTrust.ts#buildReceiptTrustCopy` so the same
 * four trust elements appear here and inside the mobile post-purchase
 * Alert (parity contract).
 *
 * Server-rendered, no auth required (the user is mid-Stripe redirect).
 * `period` + `tier` come through as query params from the success_url
 * template; both fall back to a Pro-monthly default if the redirect
 * is malformed.
 */

export const metadata: Metadata = {
  title: "Welcome to Pro",
  description: "Your subscription is active. Cancel anytime, 7-day refund.",
};

type CheckoutSuccessSearchParams = {
  session_id?: string;
  period?: string;
  tier?: string;
};

function isValidPeriod(p: string | undefined): p is "monthly" | "annual" {
  return p === "monthly" || p === "annual";
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<CheckoutSuccessSearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  const period = isValidPeriod(resolved.period) ? resolved.period : "monthly";
  const isAnnual = period === "annual";

  // Wave-2 (2026-04-30 audit): the disclosure copy on /pricing now
  // states the trial length + first-charge cadence in days, not a
  // stale clock-time, because Stripe's actual `subscription.trial_end`
  // is the authoritative anchor (we don't compute the date here at
  // render time — that would drift if the user reloaded the page on
  // day-2 of the trial). The plain-English line tells the user when
  // the charge falls in calendar terms; the confirmation email sent
  // by Stripe carries the exact wall-clock date.
  const trialEndsLabel = isAnnual
    ? "in 7 days"
    : "with your billing period";
  const cancelPath = "Settings > Subscription, or via Stripe directly";
  const receiptCopy = buildReceiptTrustCopy({ trialEndsLabel, cancelPath });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* ENG-971 — canonical Sloe wordmark (plum ink via
              `--foreground-brand`). Replaces the off-palette
              `#588CE4 → #DF5EBC` gradient clip — never in the locked
              brand palette and a billing-surface drift. */}
          <Link href="/" aria-label="Sloe home">
            <SupprWordmark size={28} />
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            You&rsquo;re in
          </h1>
          <p className="text-base text-muted-foreground">
            Welcome to Pro. Here&rsquo;s exactly what happens next.
          </p>
        </div>

        <div
          data-testid="checkout-success-receipt"
          className="rounded-2xl border border-border bg-card p-6 mb-6"
        >
          <p className="text-sm leading-relaxed text-foreground">
            {receiptCopy}
          </p>
        </div>

        <div
          data-testid="checkout-success-trust-bullets"
          className="rounded-2xl border border-border bg-card p-6 mb-6 space-y-3"
        >
          <h2 className="text-xs font-bold tracking-wider uppercase text-muted-foreground mb-3">
            Your trust commitments
          </h2>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden="true" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">Cancel anytime in-app.</span>{" "}
              <Link href="/account/billing" className="text-primary underline underline-offset-2">
                Manage subscription
              </Link>{" "}
              opens the Stripe customer portal — you cancel directly, never
              by emailing support.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden="true" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">7-day refund, no email needed.</span>{" "}
              If you cancel inside 7 days you won&rsquo;t be charged. If you
              were already charged and want a refund, we process them
              within 7 days, no questions asked.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden="true" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">Price never changes mid-trial.</span>{" "}
              The price you saw on the paywall is the price you pay. No
              surprise hikes when the trial ends.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* ENG-971 — primary CTA on the brand token (`bg-primary` /
              `--accent-primary` clay-plum), matching every other primary
              CTA (recipe nav, CheckoutButton). Replaces the off-palette
              violet→indigo gradient + violet shadow on a billing surface. */}
          <Link
            href="/home?view=today&checkout=success"
            data-testid="checkout-success-continue"
            className="flex-1 text-center px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:brightness-95 transition-all"
          >
            Open Sloe
          </Link>
          <Link
            href="/account/billing"
            data-testid="checkout-success-manage"
            className="flex-1 text-center px-6 py-3 rounded-xl font-semibold border border-border text-foreground hover:bg-card transition-colors"
          >
            Manage subscription
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Questions? Email{" "}
          <a
            href="mailto:support@suppr-club.com"
            className="text-primary underline underline-offset-2"
          >
            support@suppr-club.com
          </a>
          .
        </p>
      </main>
    </div>
  );
}
