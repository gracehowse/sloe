/**
 * Paywall value-prop + Free-vs-Pro comparison SSOT (leaf — no `@/…`
 * aliases).
 *
 * Owns the two presentational blocks introduced by Figma frame
 * `284:2` (the Sloe Pro paywall redesign):
 *
 *   1. The **2×2 value-prop grid** — four condensed Pro benefits
 *      (Unlimited imports / Macro fitting / AI coach / Cloud sync),
 *      each an icon + title + one-line description.
 *   2. The **FREE / PRO comparison matrix** — the four headline rows
 *      shown directly on the paywall (Log meals & macros · Browse
 *      community recipes · Unlimited imports · AI macro fitting). The
 *      full capability ladder still lives in `PRICING_TIERS.features`;
 *      this is the at-a-glance "what Pro adds" table the frame shows.
 *
 * Lives alongside `./pricingTiers`, `./paywallTrust`, and
 * `./nutritionSources` as a mobile-safe leaf so the React Native
 * paywall can `import` it directly with a relative path, without
 * pulling `src/lib/landing/content.ts`' full `@/…`-aliased dependency
 * graph (which doesn't resolve in `apps/mobile/tsconfig.json`).
 *
 * Drift guard: `tests/unit/paywallValueProps.test.ts` pins the grid
 * order/length, the matrix rows, and that the matrix's Free-tier
 * counts are derived from the shared `FREE_SAVE_LIMIT` /
 * `FREE_PHOTO_LOG_WEEKLY_LIMIT` constants — never hardcoded — so a
 * future limit change can't make the paywall lie.
 *
 * Why these are NOT new pricing claims: every row here maps 1:1 to a
 * gate that already exists in code (recipe-import gate, macro-fitting
 * meal-plan gate, AI-logging quota, cloud sync). This module is a
 * restyle of how the existing Pro pitch is presented, not a new
 * promise. See `docs/ux/redesign/paywall.md` §3a (value ladder) and
 * §12 (FUNCTIONALITY PRESERVED).
 */

import { FREE_SAVE_LIMIT } from "../../context/appData/constants";
import { FREE_PHOTO_LOG_WEEKLY_LIMIT } from "../nutrition/photoLogQuota";

/**
 * One cell of the 2×2 value-prop grid. `webIcon` / `mobileIcon` are
 * lucide glyph names (kept identical where the glyph exists on both
 * `lucide-react` and `lucide-react-native`, which it does for all four
 * below) so the two platforms render the same mark.
 */
export type PaywallValueProp = {
  /** Stable key for React `key=` + test assertions. */
  key: "unlimited_imports" | "macro_fitting" | "ai_coach" | "cloud_sync";
  /** lucide icon name (same string resolves on web + native here). */
  icon: "Link2" | "SlidersHorizontal" | "Sparkles" | "Cloud";
  title: string;
  description: string;
};

/**
 * The four value props, in frame order (reading order: top-left,
 * top-right, bottom-left, bottom-right). Do not reorder without
 * updating the parity test — the grid renders them positionally.
 */
export const PAYWALL_VALUE_PROPS: readonly PaywallValueProp[] = [
  {
    key: "unlimited_imports",
    icon: "Link2",
    title: "Unlimited imports",
    description: "Save any recipe from a link or Reel.",
  },
  {
    key: "macro_fitting",
    icon: "SlidersHorizontal",
    title: "Macro fitting",
    description: "Auto-fit any recipe to your day.",
  },
  {
    key: "ai_coach",
    icon: "Sparkles",
    title: "AI coach",
    description: "Personalised, guilt-free nudges.",
  },
  {
    key: "cloud_sync",
    icon: "Cloud",
    title: "Cloud sync",
    description: "Your journal, safe on every device.",
  },
] as const;

/**
 * One row of the FREE / PRO comparison matrix. `free` / `pro` are
 * either a boolean (renders ✓ when true, an em-dash when false) or a
 * short string (renders the literal value, e.g. a count). Deriving the
 * count rows from constants keeps the table honest when a limit moves.
 */
export type PaywallComparisonRow = {
  /** Stable key for React `key=` + test assertions. */
  key:
    | "log_meals_macros"
    | "browse_community"
    | "unlimited_imports"
    | "ai_macro_fitting";
  label: string;
  /** `true` → ✓, `false` → —, string → literal value. */
  free: boolean | string;
  pro: boolean | string;
};

/**
 * The four headline comparison rows shown on the paywall, in frame
 * order. The full capability ladder (13 rows) lives in
 * `PRICING_TIERS.features`; this is the at-a-glance subset the frame
 * surfaces directly under the value grid.
 *
 * Note the framing: both shared rows show ✓ in BOTH columns (Free is
 * genuinely useful), and the two Pro-only rows show — / ✓. This
 * reinforces "Pro expands Free" rather than "Free is crippled", per
 * the permission-not-restriction positioning.
 */
export const PAYWALL_COMPARISON_ROWS: readonly PaywallComparisonRow[] = [
  {
    key: "log_meals_macros",
    label: "Log meals & macros",
    free: true,
    pro: true,
  },
  {
    key: "browse_community",
    label: "Browse community recipes",
    free: true,
    pro: true,
  },
  {
    key: "unlimited_imports",
    label: "Unlimited imports",
    free: false,
    pro: true,
  },
  {
    key: "ai_macro_fitting",
    label: "AI macro fitting",
    free: false,
    pro: true,
  },
] as const;

/**
 * Re-export the source limits these blocks are derived from, so any
 * consumer rendering a richer matrix (e.g. the redesign spec's full
 * 13-row expandable table) reads the same constants and the parity
 * test has a single import surface to assert against.
 *
 * These are the count values the frame's headline matrix abstracts
 * into ✓ / — (the headline rows are pass/fail, not counts), but a
 * consumer that wants "10" / "5/wk" can read them here without
 * re-importing from two leaf modules.
 */
export const PAYWALL_FREE_LIMITS = {
  savedRecipes: FREE_SAVE_LIMIT,
  weeklyPhotoLogs: FREE_PHOTO_LOG_WEEKLY_LIMIT,
} as const;
