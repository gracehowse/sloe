/**
 * Landing-page / pricing / roadmap single source of truth.
 *
 * Any marketing surface that makes a product claim — /, /pricing,
 * /roadmap, /whats-new — must read from this file. The parity test
 * in `tests/unit/landingParity.test.tsx` pins rendered copy against
 * these constants, so drift between code and marketing is caught at
 * CI time, not by users.
 *
 * Ownership rules:
 *   1. Moving a feature between Free/Base/Pro tiers updates
 *      `PRICING_TIERS` AND the corresponding gate in code (server
 *      route or client guard).
 *   2. Changing the nutrition pipeline updates `NUTRITION_SOURCES`.
 *   3. Changing Adaptive TDEE thresholds updates the exported
 *      constants in `src/lib/nutrition/adaptiveTdee.ts` and this
 *      file re-exports them automatically.
 *   4. Every roadmap item carries an explicit status
 *      (`shipped | building | planned`). Shipped items must have
 *      real code behind them; `building` means actively worked on
 *      with visible scaffolding; `planned` means a concept with no
 *      implementation.
 */

import { FREE_SAVE_LIMIT } from "@/context/appData/constants";
import {
  MIN_LOGGING_DAYS as TDEE_MIN_LOGGING_DAYS_RAW,
  MIN_WEIGH_INS as TDEE_MIN_WEIGH_INS_RAW,
} from "@/lib/nutrition/adaptiveTdee";
import { getLatestChangelog } from "@/lib/changelog/entries";
import { NUTRITION_SOURCES } from "./nutritionSources";

/** Source-of-truth re-exports so the landing page never copies literals. */
export const TDEE_MIN_LOGGING_DAYS = TDEE_MIN_LOGGING_DAYS_RAW;
export const TDEE_MIN_WEIGH_INS = TDEE_MIN_WEIGH_INS_RAW;
export { FREE_SAVE_LIMIT };

/**
 * `NUTRITION_SOURCES` lives in `./nutritionSources` (a leaf file with
 * no `@/…` imports) so the React Native mobile app can import it
 * directly without pulling the whole SSOT and its web-aliased deps
 * into its `tsconfig` graph. Re-exported here so web consumers keep a
 * single entry-point.
 *
 * If the pipeline reorders, update the list in `./nutritionSources`
 * and the landing page's trust strip + FAQ answer, plus the mobile
 * nutrition-sources screen, update automatically.
 */
export { NUTRITION_SOURCES };

/**
 * Rolling version string for the roadmap "Now" header. Reads the
 * latest changelog entry so bumping a build automatically updates
 * the landing page label — no hand-edited version numbers.
 */
export function currentAppVersionLabel(): string {
  const entry = getLatestChangelog();
  if (!entry) return "Latest build";
  return `v${entry.appVersion} · build ${entry.buildNumber}`;
}

/** Supported client platforms. Android is deliberately not listed —
 *  the iOS app is in TestFlight; the web app is in production. */
export const SUPPORTED_PLATFORMS = {
  web: "production",
  ios: "testflight",
  android: "not_on_roadmap",
} as const;

/* ─────────────── Pricing tiers ─────────────── */

/**
 * `PRICING_TIERS` lives in `./pricingTiers` (a leaf file with no
 * `@/…` imports) so the React Native mobile app can import it
 * directly without pulling the whole SSOT and its web-aliased
 * deps into its `tsconfig` graph. Re-exported here so web
 * consumers keep a single entry-point.
 *
 * Any pricing / tier / feature-list change goes in
 * `./pricingTiers`, NOT this file. `docs/decisions/2026-04-19-pricing-v1.md`
 * records the numbers.
 */
export type {
  PricingTierName,
  BillingPeriod,
  PricingTier,
} from "./pricingTiers";
export { PRICING_TIERS } from "./pricingTiers";

/* ─────────────── How-it-works ─────────────── */

export type HowItWorksStep = { n: number; title: string; body: string };

export const HOW_IT_WORKS: HowItWorksStep[] = [
  {
    n: 1,
    title: "Paste a link — we handle the rest",
    body:
      "Drop a URL from Instagram, TikTok, YouTube, or any recipe blog with structured data. Suppr imports ingredients, steps, and photos in seconds.",
  },
  {
    n: 2,
    title: "Real macros, not rounded guesses",
    body: `Every ingredient is matched against ${NUTRITION_SOURCES.slice(0, 3).join(", ")}, and ${NUTRITION_SOURCES[3]} for branded items. Ambiguous ingredients show a confidence score so you can verify before saving.`,
  },
  {
    n: 3,
    title: "Plan weeks that hit your targets",
    body:
      "Build plans from your saved recipes and Suppr picks combinations that land on your macro targets. Generate a shopping list, then cook.",
  },
  {
    n: 4,
    title: "Adapts to how you actually eat",
    body: `Adaptive TDEE refines your maintenance estimate once you've logged ${TDEE_MIN_LOGGING_DAYS} days and weighed in ${TDEE_MIN_WEIGH_INS} times.`,
  },
];

/* ─────────────── Roadmap ─────────────── */

export type RoadmapStatus = "shipped" | "building" | "planned";

export type RoadmapItem = { text: string; status: RoadmapStatus };

export type RoadmapBucket = {
  title: "Now" | "Next" | "Later";
  badge: string;
  /** Short window label. Kept in code so it's easy to audit and
   *  update as things ship. */
  when: string;
  summary: string;
  items: RoadmapItem[];
};

/**
 * Hand-curated but pinned by the parity test: any item tagged
 * `shipped` must have a grep-able implementation anchor, and any
 * item tagged `building` must not also appear in the shipped list.
 */
export const ROADMAP: RoadmapBucket[] = [
  {
    title: "Now",
    badge: "In your app",
    when: currentAppVersionLabel(),
    summary:
      "The core loop is shipped and stable on web, with the iOS app in TestFlight beta.",
    items: [
      { text: "Recipe import from any recipe site, Instagram, TikTok, YouTube", status: "shipped" },
      { text: "Macro tracking with confidence scores", status: "shipped" },
      { text: "Meal planner with shopping list", status: "shipped" },
      { text: "Cook mode with step highlighting and inline timers", status: "shipped" },
      { text: "Apple Health sync + Adaptive TDEE", status: "shipped" },
      { text: "Barcode scanning for packaged foods", status: "shipped" },
      { text: "Voice food logging (Pro)", status: "shipped" },
      { text: "AI photo meal recognition (Pro)", status: "shipped" },
      { text: "Household sharing — plan meals across 2+ people", status: "shipped" },
    ],
  },
  {
    title: "Next",
    badge: "Building now",
    when: "Coming builds",
    summary: "What's on the bench and visible in the codebase.",
    items: [
      { text: "Creator analytics for published recipes", status: "planned" },
      { text: "Home screen widgets (iOS)", status: "building" },
      { text: "Richer macro trend reports", status: "building" },
    ],
  },
  {
    title: "Later",
    badge: "On the board",
    when: "2026 · 2027",
    summary: "Bigger bets we're designing, pending research and your feedback.",
    items: [
      { text: "Apple Watch cook-mode companion", status: "planned" },
      { text: "Grocery delivery integrations (Instacart, Amazon Fresh)", status: "planned" },
      { text: "Recipe Q&A with your own saved library", status: "planned" },
      { text: "Garmin, Fitbit, Whoop integrations", status: "planned" },
    ],
  },
];

/* ─────────────── FAQ ─────────────── */

export const FAQS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: "How accurate are the macros, really?",
    a: `Every ingredient is matched against ${NUTRITION_SOURCES[0]} first, then ${NUTRITION_SOURCES[1]}, ${NUTRITION_SOURCES[2]}, and ${NUTRITION_SOURCES[3]} for branded items. Ambiguous ingredients show a confidence score so you can verify before saving. Values are estimates — actual nutrition varies by preparation method, brand, and portion size.`,
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from account settings and you'll keep access until the end of your billing period. Your data stays — you can export it any time from Settings → Export.",
  },
  {
    q: "Does it work on iOS and web?",
    a: "Yes — the web app is in production and the iOS app is in TestFlight beta. Both share the same Supabase backend, so anything you save or log syncs instantly. Android isn't on the roadmap right now.",
  },
  {
    q: "What happens to my data if I downgrade?",
    // Copy intentionally softened from the prior "become read-only" claim
    // (sync-enforcer finding 2026-04-19): the client only blocks *new*
    // saves above `FREE_SAVE_LIMIT`; existing saves above the cap are not
    // enforced as read-only today. Keep the claim aligned to the actual
    // behaviour until (and unless) read-only enforcement ships. Further
    // softened 2026-04-19 (round-2 legal pass) to clarify recipes stay
    // editable — "read-only" was the bug, "stay saved and editable" is
    // the honest promise.
    a: `Nothing disappears. Your recipes above the Free tier's ${FREE_SAVE_LIMIT}-recipe limit stay saved and editable; you just won't be able to save new recipes until you're back at ${FREE_SAVE_LIMIT} or fewer, or on Base.`,
  },
  {
    q: "Is this a diet app?",
    a: "No. Suppr is a personal tracking tool, not a medical device. We don't do leaderboards or shaming — over-budget shows amber, not red, and targets are based on Mifflin-St Jeor so you can override them. A gentle logging streak shows after your first day logged — no pressure, no punishing copy if you miss a day.",
  },
  // Annual-plan "Coming soon" FAQ intentionally removed 2026-04-19
  // (monetisation-architect round-2): parking a placeholder with no
  // shipped SKU created an implied promise; removed to match the
  // landing's no-vapourware stance.
  {
    q: "Do you offer refunds?",
    a: "If you're unhappy within the first 7 days, email support@suppr-club.com and we'll process a refund. Refunds are handled manually via Stripe.",
  },
];
