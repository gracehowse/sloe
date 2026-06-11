/**
 * Canonical primary-navigation definition — ENG-1044 (audit 2026-06-11 P1-9).
 *
 * Three nav surfaces (native iOS tab bar, web desktop sidebar, web
 * mobile-web bottom nav) had drifted into THREE different glyph sets and
 * TWO different orders, including a hard collision: `BookOpen` meant "Plan"
 * on native but "Recipes" on web. That violates the project's "web and
 * mobile must stay in sync" non-negotiable.
 *
 * This module is the single source of truth for:
 *   - the canonical primary-tab ORDER, and
 *   - the canonical GLYPH per tab (named, platform-agnostic — each surface
 *     maps the name to its own icon component, but all must agree).
 *
 * Canonical decision (iOS leads — it's the primary surface):
 *   - **Order:** Today · Plan · Recipes · Progress. Native already ships
 *     this with a documented rationale (2026-05-13 premium-bar audit +
 *     2026-04-29 customer-lens: planning-first matches day-to-day use), and
 *     it matches the 2026-04-27 strategic-direction tab list. Web converges
 *     to it (flag-gated via `nav-tab-order-plan-first`).
 *   - **Glyphs:** Today=Calendar, Plan=BookOpen, Recipes=Utensils,
 *     Progress=BarChart3 — the native `_layout.tsx` set. This makes
 *     BookOpen=Plan and Utensils=Recipes everywhere, killing the collision.
 *
 * Pure data + types only — no React, no icon imports — so it's importable
 * from web, mobile, and tests alike. Pinned by
 * `tests/unit/primaryNavParity.test.ts`.
 */

/** The four canonical primary destinations, keyed by their stable view id. */
export type PrimaryNavView = "today" | "plan" | "recipes" | "progress";

/**
 * Canonical glyph names. Each surface maps the name → its own icon
 * component (lucide-react on web, lucide-react-native on mobile), but the
 * mapping MUST agree across surfaces.
 */
export type PrimaryNavGlyph = "Calendar" | "BookOpen" | "Utensils" | "BarChart3";

export interface PrimaryNavItem {
  view: PrimaryNavView;
  label: string;
  glyph: PrimaryNavGlyph;
}

/**
 * The canonical Plan-first order + glyph assignment. The ORDER of this
 * array is the canonical tab order; the `glyph` on each item is the
 * canonical icon. Every nav surface must render these four in this order
 * with these glyphs. Web defaults to this order (native leads); set the
 * `nav-tab-order-plan-first` flag to `false` to roll back to legacy
 * Recipes-first while ramping.
 */
export const PRIMARY_NAV_CANONICAL: readonly PrimaryNavItem[] = [
  { view: "today", label: "Today", glyph: "Calendar" },
  { view: "plan", label: "Plan", glyph: "BookOpen" },
  { view: "recipes", label: "Recipes", glyph: "Utensils" },
  { view: "progress", label: "Progress", glyph: "BarChart3" },
] as const;

/** The canonical order as bare view ids (handy for ordering helpers). */
export const PRIMARY_NAV_ORDER: readonly PrimaryNavView[] =
  PRIMARY_NAV_CANONICAL.map((i) => i.view);

/** Feature flag gating the web convergence to the canonical Plan-first order. */
export const NAV_TAB_ORDER_FLAG = "nav-tab-order-plan-first";

/**
 * Resolve whether web surfaces should render the canonical Plan-first order.
 * Native iOS already ships it; when PostHog is still loading (`undefined`)
 * we default ON so web matches iOS on first paint. Set the flag to `false`
 * explicitly to roll back to the legacy Recipes-first order.
 */
export function canonicalNavOrderEnabled(flag: boolean | undefined): boolean {
  return flag !== false;
}
