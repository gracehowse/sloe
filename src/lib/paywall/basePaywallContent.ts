/**
 * Base-focused paywall content — shared between web and mobile.
 *
 * The "Upgrade to Base" paywall (mobile `apps/mobile/app/paywall.tsx`,
 * web `app/pricing/upgrade-base/page.tsx`) is the primary conversion
 * surface for the full meal-planning loop. Both platforms render the
 * same five feature rows, hero copy, and brand gradient — this module
 * owns all of that copy so they cannot drift.
 *
 * Ported 2026-04-20 from the Claude Design prototype
 * (`docs/ux/claude-design-bundles/prototype/project/flows.jsx`,
 * `Paywall` component).
 *
 * Parity guard: `tests/unit/basePaywallContentParity.test.ts` pins the
 * row count, order, and copy strings so a future edit can't silently
 * diverge.
 */

export interface BasePaywallFeature {
  /** Stable key for test assertions + React `key=`. */
  key:
    | "meal_plans"
    | "shopping_list"
    | "cook_mode"
    | "import"
    | "unlimited_saves";
  /** Lucide icon name from the shared `src/app/components/ui/icons.ts`
   *  map — used on the web surface. */
  webIcon: "calendar" | "shopping" | "chef" | "link" | "infinity";
  /** Ionicons glyph name for the mobile surface. */
  mobileIcon:
    | "calendar-outline"
    | "cart-outline"
    | "restaurant-outline"
    | "link-outline"
    | "infinite-outline";
  title: string;
  description: string;
}

/** Order mirrors prototype top-to-bottom. Do not reorder without
 *  updating the parity test. */
export const BASE_PAYWALL_FEATURES: readonly BasePaywallFeature[] = [
  {
    key: "meal_plans",
    webIcon: "calendar",
    mobileIcon: "calendar-outline",
    title: "Meal plans matched to your macros",
    description: "A week of meals tailored to your targets. Regenerate any day.",
  },
  {
    key: "shopping_list",
    webIcon: "shopping",
    mobileIcon: "cart-outline",
    title: "Shopping list from your plan",
    description: "Aisle-sorted, quantities combined across recipes.",
  },
  {
    key: "cook_mode",
    webIcon: "chef",
    mobileIcon: "restaurant-outline",
    title: "Cook mode with timers",
    description: "Step-by-step with inline timers and per-step ingredients.",
  },
  {
    key: "import",
    webIcon: "link",
    mobileIcon: "link-outline",
    title: "Import from any source",
    description: "Instagram, TikTok, blogs — parsed and matched against USDA in seconds.",
  },
  {
    key: "unlimited_saves",
    webIcon: "infinity",
    mobileIcon: "infinite-outline",
    title: "Unlimited saved recipes",
    description: "Free tier caps at 10. Base is uncapped.",
  },
] as const;

export const BASE_PAYWALL_HERO = {
  /** Small uppercase pill above the title. */
  kicker: "SUPPR BASE",
  title: "The full meal planning loop",
  subtitle: "Plans that hit your macros, one-tap shopping lists, cook mode with timers.",
} as const;

/** Brand gradient colours for the hero. `from` → top-left,
 *  `to` → bottom-right. Matches the prototype literal values and the
 *  `Accent.primary` + `Accent.magenta` palette on mobile. */
/** Marketing-only hero gradient endpoints (not UI `--primary`). */
export const BASE_PAYWALL_GRADIENT_FROM = "#588CE4"; // Brand.primary
export const BASE_PAYWALL_GRADIENT_TO = "#DF5EBC"; // Brand.accent
