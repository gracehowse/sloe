import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link href="/" className="text-violet-600 dark:text-violet-400 hover:underline">
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
            <Link href="/privacy" className="text-violet-600 dark:text-violet-400 hover:underline">
              Privacy policy
            </Link>{" "}
            for how that processing works.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Acceptable use</h2>
          <p>
            Do not misuse the service, attempt to scrape or overload APIs, or use the product to violate others'
            rights. You are responsible for content you upload or import.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Subscriptions</h2>
          <p>
            Paid features may be billed through Stripe. Fees, renewals, and refunds follow the checkout flow and
            Stripe's policies unless your deployment states otherwise.
          </p>
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
