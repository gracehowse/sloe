/**
 * Paywall value-prop + Free-vs-Pro comparison SSOT (leaf — no `@/…`
 * aliases).
 *
 * Owns the two presentational blocks introduced by Figma frame
 * `284:2` (the Sloe Pro paywall redesign):
 *
 *   1. The **2×2 value-prop grid** — four condensed Pro benefits
 *      (Unlimited saves / Macro fitting / AI coach / Cloud sync),
 *      each an icon + title + one-line description.
 *   2. The **FREE / PRO comparison matrix** — the four headline rows
 *      shown directly on the paywall (Log meals & macros · Browse
 *      community recipes · Unlimited saves · AI macro fitting). The
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
 * gate that already exists in code (the `FREE_SAVE_LIMIT` save cap,
 * macro-fitting meal-plan gate, AI-logging quota, cloud sync). This
 * module is a restyle of how the existing Pro pitch is presented, not a
 * new promise. See `docs/ux/redesign/paywall.md` §3a (value ladder) and
 * §12 (FUNCTIONALITY PRESERVED).
 *
 * ENG-1444 (LEGAL-012, 2026-07-16): the `unlimited_imports` row used to
 * read "Unlimited imports" — false. Recipe import itself has never been
 * tier-gated (`app/api/recipe-import/route.ts` only rate-limits abuse,
 * identically for every authed user); the real Free-vs-Pro differentiator
 * is the SAVE limit (`FREE_SAVE_LIMIT`, enforced in `AppDataContext.tsx`,
 * `apps/mobile/lib/recipes.ts`, and RLS). Copy now says "Unlimited saves"
 * to match `PRICING_TIERS.pro.features[0]` ("Unlimited saved recipes"),
 * which it previously contradicted. The `unlimited_imports` key name is
 * legacy-only (React key + test lookup, never user-visible) — kept as-is
 * to keep this fix minimal; a rename is a separate fast-follow.
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
    title: "Unlimited saves",
    description: "Keep every recipe you love.",
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
    | "free_barcode_scanning"
    | "free_custom_macros"
    | "unlimited_imports"
    | "ai_macro_fitting";
  label: string;
  /** `true` → ✓, `false` → —, string → literal value. */
  free: boolean | string;
  pro: boolean | string;
  /**
   * ENG-1203 — flags this row as an MFP-switch-win callout (a feature
   * MyFitnessPal paywalled in 2026 that Suppr ships FREE: barcode
   * scanning + custom macro goals — the #1 cited exodus reasons).
   * Renderers gate these rows behind the default-on
   * `paywall_free_mfp_wins_v1` flag via {@link getPaywallComparisonRows}
   * so the merchandising change can ramp / kill-switch without a deploy.
   * Undefined on every legacy row.
   */
  mfpSwitchWin?: true;
};

/**
 * The headline comparison rows shown on the paywall, in frame order.
 * The full capability ladder (13 rows) lives in `PRICING_TIERS.features`;
 * this is the at-a-glance subset the frame surfaces directly under the
 * value grid.
 *
 * Note the framing: the shared rows show ✓ in BOTH columns (Free is
 * genuinely useful), and the two Pro-only rows show — / ✓. This
 * reinforces "Pro expands Free" rather than "Free is crippled", per
 * the permission-not-restriction positioning.
 *
 * ENG-1203 — the two `mfpSwitchWin` rows (barcode scanning + custom
 * macros) are also ✓/✓: MyFitnessPal paywalled both in 2026, so they
 * read as concrete switch reasons here. They're genuinely free in code
 * — barcode is the always-unlocked Scan chip
 * (`TodayQuickLogStrip.tsx`, `locked: false`); custom macros is the
 * onboarding manual-targets card (`data-bridges.tsx`, no Pro gate, set
 * all four to override the BMR estimate). Both columns ✓ because Pro
 * keeps them too. Renderers show these only when the default-on
 * `paywall_free_mfp_wins_v1` flag is enabled — see
 * {@link getPaywallComparisonRows}.
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
    key: "free_barcode_scanning",
    label: "Barcode scanning",
    free: true,
    pro: true,
    mfpSwitchWin: true,
  },
  {
    key: "free_custom_macros",
    label: "Custom macro goals",
    free: true,
    pro: true,
    mfpSwitchWin: true,
  },
  {
    key: "unlimited_imports",
    label: "Unlimited saves",
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
 * ENG-1203 — the PostHog flag (default-on, in `REDESIGN_DEFAULT_ON` on
 * both platforms) that gates the MFP-switch-win comparison rows
 * (barcode scanning + custom macros). Exported so renderers + tests
 * reference one string. Off → the legacy four-row matrix; on → six rows.
 */
export const PAYWALL_FREE_MFP_WINS_FLAG = "paywall_free_mfp_wins_v1";

/**
 * ENG-1203 — resolve the comparison rows to render given the
 * `paywall_free_mfp_wins_v1` flag state. Pure (no analytics import) so
 * the leaf SSOT stays mobile-safe and importable on both platforms;
 * each renderer passes the flag value it reads from its own analytics
 * module. Flag ON → all rows (including the two MFP-switch wins); flag
 * OFF → the legacy four rows only.
 */
export function getPaywallComparisonRows(
  mfpWinsEnabled: boolean,
): readonly PaywallComparisonRow[] {
  if (mfpWinsEnabled) return PAYWALL_COMPARISON_ROWS;
  return PAYWALL_COMPARISON_ROWS.filter((r) => !r.mfpSwitchWin);
}

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
