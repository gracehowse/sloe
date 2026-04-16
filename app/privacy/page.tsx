import Link from "next/link";

const DEFAULT_PRIVACY_EMAIL = "privacy@suppr-club.com";

export default function PrivacyPage() {
  const privacyEmail =
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || DEFAULT_PRIVACY_EMAIL;
  const mailtoHref = `mailto:${encodeURIComponent(privacyEmail)}`;

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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Data retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you delete your account, we will
            delete your personal data within 30 days, except where retention is required by law (e.g. billing records
            may be retained for up to 7 years for tax compliance). Anonymised, aggregated analytics data that cannot
            identify you may be retained indefinitely.
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Your rights and choices</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Export your data:</strong> You can export locally stored data from Settings (Download your data).
            </li>
            <li>
              <strong>Delete your account:</strong> You can permanently delete your account and all associated data
              from Settings on web or mobile. Deletion is processed immediately for app data; billing records may be
              retained for up to 7 years as required by law.
            </li>
            <li>
              <strong>Withdraw consent:</strong> You can sign out at any time and disable optional analytics or
              error reporting via your cookie preferences.
            </li>
            <li>
              <strong>Access and correction:</strong> You can view and update your personal data in your profile at
              any time, or request a copy by contacting support.
            </li>
            <li>
              <strong>EU/UK residents:</strong> Under GDPR, you have the right to access, rectify, erase, restrict
              processing, data portability, and to object to processing. To exercise these rights, contact the
              support channel below.
            </li>
          </ul>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Contact</h2>
          <p>
            For questions about this policy, data requests, or to exercise your rights, email us
            at{" "}
            <a href={mailtoHref} className="text-violet-600 dark:text-violet-400 underline">
              {privacyEmail}
            </a>.
            We aim to respond within 14 days.
          </p>
        </div>
      </div>
    </div>
  );
}
