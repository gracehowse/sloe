import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link href="/" className="text-violet-600 dark:text-violet-400 hover:underline">
            ← Back to app
          </Link>
        </p>

        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">Help</h1>

        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Activity-adjusted calories</h2>
          <p>
            If you turn on activity adjustment in the Nutrition tracker, your daily calorie target can move with your
            activity for that day.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Data quality</h2>
          <p>
            We aim to keep food and recipe info consistent and easy to trust. If you ever notice something off, treat it
            as an estimate and adjust your portion or entry as needed.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Pricing</h2>
          <p>Features may change as we finalize pricing and plan options.</p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">What’s coming (high level)</h2>
          <p>
            We’re focused on making logging fast and planning feel effortless. Some larger features may appear later as
            we improve the core experience.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Sponsored content</h2>
          <p>If something is sponsored or affiliate, it will be clearly disclosed.</p>

          <hr />

          <p>
            Looking for legal details? See the <Link href="/privacy">privacy policy</Link> and{" "}
            <Link href="/terms">terms of service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

