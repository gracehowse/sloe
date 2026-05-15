import Link from "next/link";
import type { Metadata } from "next";
import { TrustPageLayout } from "../../src/app/components/trust/TrustPageLayout";

export const metadata: Metadata = {
  title: "Open-source licences — Suppr",
  description: "Open-source software, data, and content used by Suppr, with licence notices.",
};

type Entry = { name: string; licence: string; purpose: string; url: string };

const CODE_LICENCES: Entry[] = [
  { name: "Next.js", licence: "MIT", purpose: "Web framework", url: "https://github.com/vercel/next.js" },
  { name: "React, React DOM", licence: "MIT", purpose: "UI runtime", url: "https://github.com/facebook/react" },
  { name: "React Native", licence: "MIT", purpose: "Mobile runtime", url: "https://github.com/facebook/react-native" },
  { name: "Expo (expo-router, expo-camera, expo-apple-authentication, expo-notifications, expo-share-intent, expo-splash-screen, EAS)", licence: "MIT", purpose: "Mobile toolchain", url: "https://github.com/expo/expo" },
  { name: "Supabase JS, Supabase SSR", licence: "MIT", purpose: "Auth, database, storage client", url: "https://github.com/supabase/supabase-js" },
  { name: "Radix UI (multiple packages)", licence: "MIT", purpose: "UI primitives", url: "https://github.com/radix-ui/primitives" },
  { name: "Tailwind CSS", licence: "MIT", purpose: "Styling", url: "https://github.com/tailwindlabs/tailwindcss" },
  { name: "shadcn/ui patterns", licence: "MIT", purpose: "UI component patterns", url: "https://github.com/shadcn-ui/ui" },
  { name: "lucide-react", licence: "ISC", purpose: "Icons (web)", url: "https://github.com/lucide-icons/lucide" },
  { name: "@expo/vector-icons (Ionicons, Material, FontAwesome Free)", licence: "MIT / OFL-1.1 / CC-BY-4.0", purpose: "Icons (mobile)", url: "https://github.com/expo/vector-icons" },
  { name: "Sentry (React Native, Next.js SDKs)", licence: "MIT", purpose: "Error reporting", url: "https://github.com/getsentry/sentry-javascript" },
  { name: "PostHog JS", licence: "MIT", purpose: "Product analytics", url: "https://github.com/PostHog/posthog-js" },
  { name: "Stripe JS, Stripe Node", licence: "MIT", purpose: "Billing", url: "https://github.com/stripe/stripe-node" },
  { name: "@upstash/ratelimit, @upstash/redis", licence: "MIT", purpose: "Rate limiting", url: "https://github.com/upstash/ratelimit" },
  { name: "react-native-health (patched)", licence: "MIT", purpose: "Apple Health integration", url: "https://github.com/agencyenterprise/react-native-health" },
  { name: "react-native-purchases (RevenueCat SDK)", licence: "MIT", purpose: "iOS IAP", url: "https://github.com/RevenueCat/react-native-purchases" },
  { name: "zod / sonner / vaul / recharts / motion", licence: "MIT", purpose: "Misc UI + form utilities", url: "https://www.npmjs.com/" },
  { name: "caniuse-lite", licence: "CC-BY-4.0", purpose: "Build-time browser-support data", url: "https://github.com/browserslist/caniuse-lite" },
  { name: "Lightning CSS (build-time, via Tailwind / Expo)", licence: "MPL-2.0", purpose: "CSS toolchain", url: "https://github.com/parcel-bundler/lightningcss" },
  { name: "Inter (font, via next/font)", licence: "OFL-1.1", purpose: "Typography", url: "https://rsms.me/inter/" },
];

const DATA_LICENCES: Entry[] = [
  { name: "USDA FoodData Central", licence: "Public domain (US Government works)", purpose: "Nutrition data for whole foods. USDA does not endorse Suppr.", url: "https://fdc.nal.usda.gov/" },
  { name: "Open Food Facts", licence: "Open Database License 1.0 (ODbL)", purpose: "Product and barcode data. Data © Open Food Facts contributors.", url: "https://opendatacommons.org/licenses/odbl/1-0/" },
  { name: "Edamam Food Database API", licence: "Edamam API terms (commercial licence)", purpose: "Restaurant and branded-food nutrition. Powered by Edamam.", url: "https://www.edamam.com/" },
  { name: "FatSecret Platform API", licence: "FatSecret Platform terms (Basic developer tier — non-caching)", purpose: "Food and nutrition database. Macros are fetched at request time and not stored.", url: "https://platform.fatsecret.com/" },
];

export default function LicencesPage() {
  return (
    <TrustPageLayout
      title="Open-source & open-data licences"
      lastUpdated="April 2026"
      version="v1.0"
      subtitle="The software Suppr ships and the data Suppr displays — and the licences they use."
      revisionPath="app/licences/page.tsx"
    >
        <p className="text-sm text-slate-700 dark:text-slate-300 mb-8">
          Suppr is built on the work of hundreds of open-source contributors and the maintainers of public food-data
          databases. This page lists the licences that apply to software Suppr ships and to data it displays. The
          information here is provided for transparency and to meet attribution obligations. &ldquo;Trademarks&rdquo; of
          respective owners.
        </p>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Nutrition &amp; product data</h2>
          {/* 2026-05-13 (premium-bar audit Group A trust #5):
              dual-render — stacked cards on mobile-web (where the
              horizontal-scroll table read as broken), full table on
              md+. Same data, no SSR/CSR fork — content is identical. */}
          <ul className="md:hidden space-y-2">
            {DATA_LICENCES.map((e) => (
              <li
                key={e.name}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3 text-xs"
              >
                <a
                  className="block font-semibold text-violet-600 dark:text-violet-400 underline"
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {e.name}
                </a>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{e.licence}</p>
                <p className="mt-1 text-slate-700 dark:text-slate-300">{e.purpose}</p>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-2 font-semibold">Source</th>
                  <th className="text-left p-2 font-semibold">Licence</th>
                  <th className="text-left p-2 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="[&>tr>td]:p-2 [&>tr]:border-t [&>tr]:border-slate-200 dark:[&>tr]:border-slate-800">
                {DATA_LICENCES.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <a className="text-violet-600 dark:text-violet-400 underline" href={e.url} target="_blank" rel="noopener noreferrer">
                        {e.name}
                      </a>
                    </td>
                    <td>{e.licence}</td>
                    <td>{e.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Open Food Facts data is provided under the Open Database License; the full licence text is at{" "}
            <a className="text-violet-600 dark:text-violet-400 underline" href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">
              opendatacommons.org/licenses/odbl/1-0
            </a>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Open-source software</h2>
          <ul className="md:hidden space-y-2">
            {CODE_LICENCES.map((e) => (
              <li
                key={e.name}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3 text-xs"
              >
                <a
                  className="block font-semibold text-violet-600 dark:text-violet-400 underline"
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {e.name}
                </a>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{e.licence}</p>
                <p className="mt-1 text-slate-700 dark:text-slate-300">{e.purpose}</p>
              </li>
            ))}
          </ul>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-900">
                <tr>
                  <th className="text-left p-2 font-semibold">Package</th>
                  <th className="text-left p-2 font-semibold">Licence</th>
                  <th className="text-left p-2 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="[&>tr>td]:p-2 [&>tr]:border-t [&>tr]:border-slate-200 dark:[&>tr]:border-slate-800">
                {CODE_LICENCES.map((e) => (
                  <tr key={e.name}>
                    <td>
                      <a className="text-violet-600 dark:text-violet-400 underline" href={e.url} target="_blank" rel="noopener noreferrer">
                        {e.name}
                      </a>
                    </td>
                    <td>{e.licence}</td>
                    <td>{e.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            This list covers runtime and build-time dependencies with notice-bearing licences. Additional transitive
            dependencies are MIT, BSD, ISC, or Apache-2.0 licensed and do not require separate attribution beyond the
            acknowledgement above. A full machine-readable list can be generated from the project lockfile with{" "}
            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">npx license-checker --production --json</code>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Trademarks</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Apple, Apple Health, Apple Watch, App Store, iPhone, iOS, Sign in with Apple, and TestFlight are trademarks
            of Apple Inc. Google Play and Android are trademarks of Google LLC. Instagram, Meta, and WhatsApp are
            trademarks of Meta Platforms, Inc. TikTok is a trademark of ByteDance Ltd. Pinterest is a trademark of
            Pinterest, Inc. YouTube is a trademark of Google LLC. Stripe is a trademark of Stripe, Inc. RevenueCat is a
            trademark of RevenueCat, Inc. Expo is a trademark of 650 Industries, Inc. Supabase is a trademark of
            Supabase, Inc. Sentry is a trademark of Functional Software, Inc. PostHog is a trademark of PostHog, Inc.
            Vercel is a trademark of Vercel Inc. Open Food Facts is a project of the association Open Food Facts.
            Edamam is a trademark of Edamam, LLC. FatSecret is a trademark of FatSecret, LLC. Mention of these
            trademarks in the product does not imply any partnership, sponsorship, or endorsement. All other product
            and company names mentioned are trademarks of their respective owners.
          </p>
        </section>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          See also:{" "}
          <Link href="/terms" className="text-violet-600 dark:text-violet-400 underline">Terms of Service</Link>
          {" "}&middot;{" "}
          <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">Privacy Policy</Link>
          {" "}&middot;{" "}
          <Link href="/dmca" className="text-violet-600 dark:text-violet-400 underline">DMCA</Link>
        </p>
    </TrustPageLayout>
  );
}
