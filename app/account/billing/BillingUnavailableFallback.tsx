/**
 * Static fallback shown when Stripe is unavailable (unset key, API
 * error) on `/account/billing`.
 *
 * Copy signed off by legal-reviewer round-6 (2026-04-19):
 *   - Softened SLA ("usually reply within one business day" —
 *     can't commit to a hard SLA without a paid support rota).
 *   - Added explicit cancel-pathway line (no ambiguity about what
 *     replying to support actually gets the user).
 *   - Added App Store subscription disclaimer so iOS subscribers
 *     who accidentally land here know the cancel path is in iOS
 *     Settings, not email (Apple policy — we cannot cancel an IAP
 *     subscription from the server).
 *   - Added a visible link to `/terms#refunds` so the 7-day refund
 *     policy is one click away from the fallback.
 *
 * Extracted from `page.tsx` into its own leaf module so it can be
 * unit-rendered without pulling the Supabase SSR / Stripe SDK graph
 * the page itself depends on.
 */
export function BillingUnavailableFallback() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
          Manage your billing
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Manage your billing by emailing{" "}
          <a
            href="mailto:support@getsloe.com"
            className="text-primary underline underline-offset-2"
          >
            support@getsloe.com
          </a>
          . You can cancel anytime by replying to support; we&apos;ll process
          it on the same business day. We usually reply within one business
          day.
        </p>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
          If you originally subscribed through the App Store, cancel in iOS
          Settings → Apple ID → Subscriptions instead.
        </p>
        <p className="mt-4 text-sm">
          <a
            href="/terms#refunds"
            className="text-primary underline underline-offset-2"
          >
            7-day refund policy
          </a>
        </p>
      </div>
    </div>
  );
}
