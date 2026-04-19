import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link
            href="/"
            className="text-violet-600 dark:text-violet-400 underline underline-offset-2 hover:text-violet-700 dark:hover:text-violet-300"
          >
            ← Back to app
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">Terms of service</h1>
        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-slate-700 dark:text-slate-300">
          <p>
            <strong>Last updated:</strong> April 2026. By using Suppr you agree to these terms. If you use a
            hosted instance, the operator may add their own terms.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">The service</h2>
          <p>
            Suppr is provided "as is" for personal nutrition and recipe planning. Nutrition estimates, barcode data,
            and third-party recipe imports may be incomplete or inaccurate. Always verify critical dietary or medical
            decisions with a professional. Optional AI-assisted features (for example photo or voice meal logging) rely
            on third-party models; see the{" "}
            <Link
              href="/privacy"
              className="text-violet-600 dark:text-violet-400 underline underline-offset-2 font-medium hover:text-violet-700 dark:hover:text-violet-300"
            >
              Privacy policy
            </Link>{" "}
            for how that processing works.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Eligibility</h2>
          <p>
            You must be at least 13 years old to use Suppr (or 16 in jurisdictions where GDPR applies without
            parental consent). By creating an account, you confirm you meet this age requirement.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Acceptable use</h2>
          <p>
            Do not misuse the service, attempt to scrape or overload APIs, or use the product to violate others'
            rights. You are responsible for content you upload or import.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Subscriptions</h2>
          <p>
            Paid features may be billed through Stripe (web) or Apple's App Store / Google Play (mobile). On
            mobile, payment is processed by the respective app store. Prices are shown before purchase in your
            local currency. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the
            current billing period. You can manage or cancel your subscription:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>iOS:</strong> Settings &gt; Apple ID &gt; Subscriptions</li>
            <li><strong>Android:</strong> Google Play &gt; Payments &amp; subscriptions</li>
            <li><strong>Web:</strong> Via the Stripe customer portal linked in your account settings</li>
          </ul>
          <p>
            You can restore previous purchases at any time from the app's paywall or settings screen. Refund
            policies follow the respective platform's guidelines (Apple, Google, or Stripe).
          </p>
          <section id="refunds" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Refunds (7-day policy)</h2>
            <p>
              If you're unhappy with a Suppr subscription purchased on the web within the first 7 days of
              your billing period, email <a
                href="mailto:support@suppr-club.com"
                className="text-violet-600 dark:text-violet-400 underline underline-offset-2 font-medium hover:text-violet-700 dark:hover:text-violet-300"
              >support@suppr-club.com</a> and we'll process a refund manually via Stripe. Mobile purchases
              made through the Apple App Store or Google Play are governed by the respective store's refund
              policy — please use Apple's "Report a Problem" or Google Play's refund flow for those.
            </p>
          </section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Suppr and its contributors are not liable for indirect or
            consequential damages arising from use of the app.
          </p>
        </div>
      </div>
    </div>
  );
}
