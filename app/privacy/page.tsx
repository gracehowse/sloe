import Link from "next/link";
import { TrustPageLayout } from "../../src/app/components/trust/TrustPageLayout";

const DEFAULT_PRIVACY_EMAIL = "privacy@getsloe.com";

// 2026-05-12 (premium-bar audit Group A trust pages — sticky ToC):
// privacy is the most-jumped-to trust surface (UK/EU users looking
// for "data controller" / "your rights" / "sub-processors"). Section
// ids map 1:1 with the h2 elements below.
const PRIVACY_SECTIONS = [
  { id: "controller", title: "Data controller" },
  { id: "collect", title: "What we collect" },
  { id: "use", title: "How we use data" },
  { id: "ai", title: "AI, voice, and images" },
  { id: "imported", title: "Imported recipes" },
  { id: "community-food-database", title: "Community food database" },
  { id: "subprocessors", title: "Sub-processors" },
  { id: "community-food-database", title: "Community food database" },
  { id: "transfers", title: "International transfers" },
  { id: "legal-basis", title: "Legal basis (EU/UK)" },
  { id: "automated", title: "Automated processing" },
  { id: "health", title: "Apple Health (iOS)" },
  { id: "retention", title: "Data retention" },
  { id: "rights", title: "Your rights and choices" },
  { id: "contact", title: "Contact" },
];

export default function PrivacyPage() {
  const privacyEmail =
    process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || DEFAULT_PRIVACY_EMAIL;
  const mailtoHref = `mailto:${encodeURIComponent(privacyEmail)}`;

  return (
    <TrustPageLayout
      title="Privacy policy"
      lastUpdated="June 2026"
      version="v1.1"
      subtitle="What we process, who we share it with, and your choices."
      sections={PRIVACY_SECTIONS}
      revisionPath="app/privacy/page.tsx"
    >
        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-slate-700 dark:text-slate-300">
          <p>
            Sloe helps you log recipes, nutrition, and discover meals.
            This policy describes what we process, who we share it with, and your choices.
          </p>
          <h2 id="controller" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Data controller</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Controller:</strong> Sloe is currently operated by Grace Howse as a sole operator pending
              incorporation. We will update this notice when the operating entity is formed.
            </li>
            <li>
              <strong>Privacy contact:</strong>{" "}
              <a href={mailtoHref} className="text-primary-solid underline">
                {privacyEmail}
              </a>
            </li>
            <li>
              <strong>UK Representative (UK GDPR Art. 27):</strong> To be appointed before UK public launch.
              Required for non-UK controllers offering goods or services to individuals in the UK.
            </li>
            <li>
              <strong>EU Representative (EU GDPR Art. 27):</strong> To be appointed before EU public launch.
              Required for non-EU controllers offering goods or services to individuals in the EU.
            </li>
          </ul>
          <h2 id="collect" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">What we collect</h2>
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
              <strong>Technical:</strong> standard server logs (e.g. IP address for rate limiting and abuse prevention),
              device type, and optional analytics or error reporting if you do not opt out.
            </li>
          </ul>
          <h2 id="use" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">How we use data</h2>
          <p>
            To provide the service (logging, meal planning, barcode and recipe features), improve reliability, and
            comply with law. We do not sell your personal data.
          </p>
          <h2 id="ai" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">AI, voice, and images</h2>
          <p>
            If you use optional features, we send the minimum content needed to operate them to our servers and, where
            described below, to model providers:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Photo meal logging:</strong> images you upload are processed to suggest food items and nutrition
              estimates. This processing uses third-party AI (primarily Anthropic Claude; OpenAI as a fallback).
            </li>
            <li>
              <strong>Voice / text meal logging:</strong> text you submit (typed or transcribed) is processed to parse
              foods and estimates and uses third-party AI (primarily Anthropic Claude; OpenAI as a fallback). On the web, browser-based speech recognition
              (Web Speech API) may run on your device or via your browser/OS vendor before text reaches us; review your
              browser and OS privacy settings if you use that path.
            </li>
            <li>
              <strong>Recipe and social import:</strong> URLs or shared links you provide may be fetched or parsed to
              extract recipe content. Images from imports are treated like other uploads when you choose image-based
              flows.
            </li>
          </ul>
          <h2 id="imported" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">
            Imported recipes from public posts
          </h2>
          <p data-testid="privacy-imported-recipes-disclosure">
            When you share a public post from Instagram, TikTok, or YouTube to
            Sloe, our app reads the caption text you sent us. We never fetch
            the original post or video from those platforms ourselves. We store
            the caption text you supplied, plus the URL, plus the creator&rsquo;s
            public handle (when available) &mdash; so the recipe is attributed
            back to its source.
          </p>
          <p>
            Creators can request removal of any recipe imported from their
            public post by emailing{" "}
            <a
              href="mailto:dmca@getsloe.com"
              className="text-primary-solid underline"
            >
              dmca@getsloe.com
            </a>{" "}
            or by submitting the form on{" "}
            <Link href="/dmca" className="text-primary-solid underline">
              /dmca
            </Link>
            . We&rsquo;ll remove within 7 business days.
          </p>

          <h2 id="community-food-database" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">
            Community food database
          </h2>
          <p data-testid="privacy-community-food-database-disclosure">
            When you correct or add a barcode product, Sloe stores the product
            data with your account as the submitter so the community database
            can be reviewed for quality and abuse. Other users may see the
            product name, barcode, brand, nutrition values, verification status,
            and community votes; they do not see your email or profile details.
            You can remove products you shared from Settings &rarr; Privacy
            &amp; Security &rarr; Barcode contributions on web, or Settings
            &rarr; Account &rarr; Barcode contributions on mobile.
          </p>

          <h2 id="subprocessors" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Sub-processors</h2>
          <p>
            We use the following third-party service providers to operate Sloe. We require a data-processing agreement
            (or equivalent contractual terms) with each provider before it processes personal data on our behalf, and
            each processes your data only on our instructions. We are completing these agreements as part of our launch
            preparations.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-2 font-semibold">Provider</th>
                  <th className="text-left p-2 font-semibold">Purpose</th>
                  <th className="text-left p-2 font-semibold">Data received</th>
                  <th className="text-left p-2 font-semibold">Region</th>
                </tr>
              </thead>
              <tbody className="[&>tr>td]:p-2 [&>tr]:border-t [&>tr]:border-slate-200 dark:[&>tr]:border-slate-800">
                <tr><td>Supabase</td><td>Database, auth, storage</td><td>Account, app data, uploads</td><td>EU (Frankfurt)</td></tr>
                <tr><td>Vercel</td><td>Hosting, edge network</td><td>HTTP requests, IP</td><td>Global edge, US primary</td></tr>
                <tr><td>Upstash</td><td>Rate-limit state</td><td>IP, request counters</td><td>US / EU</td></tr>
                <tr><td>Stripe</td><td>Web billing</td><td>Email, payment card (collected by Stripe directly)</td><td>US / Ireland</td></tr>
                <tr><td>Apple (App Store, HealthKit, Sign in with Apple)</td><td>iOS purchases, sign-in relay, HealthKit sync</td><td>IAP receipt, private relay email, Health permission grants</td><td>Global</td></tr>
                <tr><td>RevenueCat</td><td>iOS IAP receipt verification</td><td>IAP receipt, user id</td><td>US</td></tr>
                <tr><td>Expo / EAS</td><td>Mobile OTA updates, push tokens, crash logs</td><td>Device id, push token</td><td>US</td></tr>
                <tr><td>Anthropic (Claude)</td><td>AI features — primary provider (photo / text meal logging, recipe parsing, refinement)</td><td>Uploaded image, caption / URL / text (no account data)</td><td>US</td></tr>
                <tr><td>fal.ai</td><td>AI image generation (recipe hero / ingredient images)</td><td>Recipe title + ingredient names you entered (no account data)</td><td>US</td></tr>
                <tr><td>OpenAI</td><td>AI features — fallback provider (used only when the primary is unavailable)</td><td>Uploaded image, caption / URL text (no account data)</td><td>US</td></tr>
                <tr><td>Supadata</td><td>Recipe-import content acquisition (web page scrape / video transcript)</td><td>The URL you import + the public page/transcript content it returns (no account data)</td><td>US</td></tr>
                <tr><td>Edamam</td><td>Food database lookups</td><td>Ingredient text query (no account data)</td><td>US</td></tr>
                <tr><td>FatSecret</td><td>Food database lookups</td><td>Ingredient text query (no account data)</td><td>US</td></tr>
                <tr><td>USDA FoodData Central</td><td>Public-domain food database</td><td>Ingredient text query (no account data)</td><td>US (public sector)</td></tr>
                <tr><td>Open Food Facts</td><td>Product / barcode lookups</td><td>Barcode or product name (no account data)</td><td>EU (France)</td></tr>
                <tr><td>PostHog</td><td>Product analytics + session replay (if not opted out)</td><td>Event names, device id, page views, replay of UI interactions with form inputs masked</td><td>EU (Frankfurt)</td></tr>
                <tr><td>Sentry</td><td>Error reporting (if not opted out)</td><td>Stack traces, device type, user id</td><td>EU (Frankfurt)</td></tr>
                <tr><td>Google Play</td><td>Android purchases (future)</td><td>Purchase token, account email</td><td>Global</td></tr>
              </tbody>
            </table>
          </div>
          <h2 id="community-food-database" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Community food database</h2>
          <p>
            When you scan a barcode we can&rsquo;t find and enter the product&rsquo;s nutrition yourself, we offer you an
            optional choice to contribute that entry to Sloe&rsquo;s shared food database so other people who scan the
            same barcode can use it too. This is strictly opt-in: it only happens if you explicitly choose{" "}
            <strong>&ldquo;Share it&rdquo;</strong> &mdash; never automatically, and never as part of logging food to
            your own tracker.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>What&rsquo;s shared:</strong> only the food name and the nutrition values you entered (calories,
              protein, carbs, fat, fibre, serving size) and the barcode. Your submission is linked to your account as
              the submitter internally, but your identity is not shown to other users. Nothing else from your account is
              shared.</li>
            <li><strong>Purpose:</strong> a shared lookup so the next person who scans that barcode gets nutrition info
              instead of a dead end.</li>
            <li><strong>Visibility:</strong> your contribution is visible only to you until it is confirmed &mdash; once
              enough independent submissions agree on the same values, it becomes the entry everyone sees when they scan
              that barcode.</li>
            <li><strong>Eligibility:</strong> you must be 16 or older to contribute to the shared database. Logging food
              privately to your own tracker has no such restriction.</li>
            <li><strong>Withdrawal:</strong> you can delete your own contributions at any time from your saved items.</li>
          </ul>
          <h2 id="transfers" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">International transfers</h2>
          <p>
            Several sub-processors listed above are located in the United States (Vercel, Anthropic, OpenAI, fal.ai,
            Supadata, Stripe, Upstash, RevenueCat, Expo, Edamam, FatSecret, USDA). Where we transfer personal data of EU or UK users to a
            country not covered
            by an adequacy decision, we rely on the European Commission&rsquo;s Standard Contractual Clauses (SCCs) and,
            for UK transfers, the UK International Data Transfer Addendum or the UK IDTA, together with supplementary
            technical and organisational measures (encryption in transit, access controls). A copy of the relevant
            transfer safeguards for any specific sub-processor is available on request by emailing the address at the
            foot of this page.
          </p>
          <h2 id="legal-basis" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Legal basis (EU/UK)</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Providing the service (account, logging, planning):</strong> performance of a contract.</li>
            <li><strong>AI features, analytics, error reporting:</strong> our legitimate interests in improving and
              securing the service (you can opt out of analytics and error reporting; AI features are opt-in per
              action).</li>
            <li><strong>Health &amp; wellness data (weight, body measurements, HealthKit metrics, and food logs in a
              nutrition context):</strong> your explicit consent (GDPR Art. 9(2)(a)). These special-category data are
              processed by Supabase (weight, measurements, food logs) and Apple HealthKit (device metrics you choose to
              share); you can withdraw at any time by turning off the relevant sync or deleting your data.</li>
            <li><strong>Contributing to the shared food database:</strong> your consent (opt-in, 16+; you can withdraw
              at any time by deleting your submission).</li>
            <li><strong>Marketing email (if any):</strong> your consent.</li>
            <li><strong>Legal and safety:</strong> compliance with legal obligations.</li>
          </ul>
          <h2 id="automated" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Automated processing</h2>
          <p>
            AI-derived nutrition matches, meal photo identification and ingredient parsing are automated but are
            estimates — a human (you) reviews and edits every saved entry before it enters your tracker. These features
            do not make decisions that produce legal or similarly significant effects about you.
          </p>
          <h2 id="health" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Apple Health (iOS)</h2>
          <p>
            If you enable the Apple Health integration on iOS, Sloe reads the following data to keep your tracker in sync:
            steps, active energy, basal energy, workouts, weight, body fat percentage, and any dietary entries already in
            Apple Health (for example logs you created in other apps). Sloe writes the calories, protein, carbohydrates,
            fat, and fibre of the meals you log back to Apple Health so other apps on your phone can read them. Data shared
            with Apple Health is governed by{" "}
            <a href="https://www.apple.com/legal/privacy/en-ww/" className="text-primary-solid underline" rel="noopener noreferrer" target="_blank">Apple&rsquo;s privacy policy</a>{" "}
            and stored on your device; Sloe does not send your Health data to our servers unless you explicitly log a meal.
            You can revoke Sloe&rsquo;s Health access at any time in iOS Settings &rarr; Privacy &amp; Security &rarr; Health &rarr; Sloe.
          </p>
          <h2 id="retention" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Data retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you delete your account, we will
            delete your personal data within 30 days, except where retention is required by law (e.g. billing records
            may be retained for up to 7 years for tax compliance). Anonymised, aggregated analytics data from which you
            cannot reasonably be re-identified may be retained indefinitely.
          </p>
          <h2 id="rights" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Your rights and choices</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Export your data:</strong> You can export locally stored data from Settings (Download your data).
            </li>
            <li>
              <strong>Delete your account:</strong> You can permanently delete your account and all associated data
              from Settings on web or mobile. Deletion is processed immediately for app data; billing records may be
              retained as required by applicable tax and accounting law (typically up to 7 years in the UK).
            </li>
            <li>
              <strong>Withdraw consent:</strong> You can sign out at any time and disable optional analytics or
              error reporting via your cookie preferences.
            </li>
            <li>
              <strong>Barcode contributions:</strong> You can remove products you shared with the community food
              database from Settings on web or mobile.
            </li>
            <li>
              <strong>Access and correction:</strong> You can view and update your personal data in your profile at
              any time, or request a copy by contacting support.
            </li>
            <li>
              <strong>EU/UK residents:</strong> Under GDPR / UK GDPR you have the right to access, rectify, erase,
              restrict processing, data portability, and to object to processing. You also have the right to complain
              to your national data-protection authority (in the UK, the Information Commissioner&rsquo;s Office at{" "}
              <a href="https://ico.org.uk" className="text-primary-solid underline" rel="noopener noreferrer" target="_blank">ico.org.uk</a>).
              To exercise these rights, contact the support channel below.
            </li>
          </ul>
          <h2 id="contact" className="scroll-mt-16 text-lg font-semibold text-slate-900 dark:text-white pt-2">Contact</h2>
          <p>
            For questions about this policy, data requests, or to exercise your rights, email us
            at{" "}
            <a href={mailtoHref} className="text-primary-solid underline">
              {privacyEmail}
            </a>.
            We aim to respond within 14 days.
          </p>
        </div>
    </TrustPageLayout>
  );
}
