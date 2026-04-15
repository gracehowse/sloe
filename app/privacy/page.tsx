import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link href="/" className="text-violet-600 dark:text-violet-400 hover:underline">
            ← Back to app
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">Privacy policy</h1>
        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-slate-700 dark:text-slate-300">
          <p>
            <strong>Last updated:</strong> April 2026. Suppr helps you log recipes, nutrition, and discover meals.
            This policy describes what we process and your choices.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">What we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Account:</strong> email and profile fields you provide (e.g. display name, goals, measurements)
              when you create an account and sign in.
            </li>
            <li>
              <strong>App usage data:</strong> nutrition logs, saved recipes, and preferences you store in the
              application or synced to our database.
            </li>
            <li>
              <strong>Technical:</strong> standard server logs (e.g. IP for rate limiting), and optional analytics or
              error reporting if you enable those integrations in the deployed environment.
            </li>
          </ul>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">How we use data</h2>
          <p>
            To provide the service (logging, meal planning, barcode and recipe features), improve reliability, and
            comply with law. We do not sell your personal data.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">AI, voice, and images</h2>
          <p>
            If you use optional features, we send the minimum content needed to operate them to our servers and, where
            described below, to model providers:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Photo meal logging:</strong> images you upload are processed to suggest food items and nutrition
              estimates. This processing may use third-party AI (e.g. OpenAI vision models).
            </li>
            <li>
              <strong>Voice / text meal logging:</strong> text you submit (typed or transcribed) is processed to parse
              foods and estimates and may use third-party AI (e.g. OpenAI). On the web, browser-based speech recognition
              (Web Speech API) may run on your device or via your browser/OS vendor before text reaches us; review your
              browser and OS privacy settings if you use that path.
            </li>
            <li>
              <strong>Recipe and social import:</strong> URLs or shared links you provide may be fetched or parsed to
              extract recipe content. Images from imports are treated like other uploads when you choose image-based
              flows.
            </li>
          </ul>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Subprocessors and infrastructure</h2>
          <p>
            Depending on how Suppr is deployed, data may be processed by service providers such as hosting,
            database, authentication, payments, analytics, error monitoring, and AI inference. Examples include
            Supabase (auth/database), Stripe (billing), PostHog or similar (product analytics, if enabled), Sentry or
            similar (errors, if enabled), and OpenAI (optional AI features). The exact list for your deployment should be
            confirmed with the operator of that environment.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Your choices</h2>
          <p>
            You can export locally stored data from Settings (Download your data) and sign out at any time. For
            data stored with your account online, use your account controls or contact the operator of your deployment.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Contact</h2>
          <p>
            Questions about this policy should go to the support channel for your Suppr deployment (e.g. the app
            maintainer or organization).
          </p>
        </div>
      </div>
    </div>
  );
}
