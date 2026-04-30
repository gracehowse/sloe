"use client";

import { Plus } from "lucide-react";

/**
 * LogFab — persistent circular Log button that lived at the
 * bottom-right of Today on mobile-web.
 *
 * STATUS (2026-04-30, deferred deletion): no longer rendered on
 * mobile-web. The canonical Log entry point is now the centered
 * raised Plus button in the App.tsx mobile-web `<nav>` (parity with
 * mobile commit `6633d2d`, which moved the FAB into a custom
 * `<SupprTabBar>` slot between Recipes and Plan). Customer-lens
 * audit flagged the side FAB as overlapping right-edge meal cards
 * + macro tile column on Today, and as the wrong iOS genre — Cal AI
 * / Lifesum / MyFitnessPal / Twitter X all converged on a centered
 * raised tab-bar button. This file is preserved for now so existing
 * imports and tests resolve until a follow-up sweep removes both
 * the web and mobile primitive files together.
 *
 * The implementation below is left intact (and the existing
 * `tests/unit/logFab.test.tsx` still asserts the primitive's
 * contract for the component itself) but no production caller
 * renders it. The "no longer rendered" pin lives in
 * `tests/unit/mobileWebRaisedLogButton.test.ts`.
 *
 * Authority history:
 *   D-2026-04-27-15 — "Persistent Log FAB on Today. One sheet with
 *   tabs: search / barcode / recent / saved / voice / photo."
 *   (FAB placement evolved 2026-04-30; the LogSheet authority is
 *   unchanged.)
 *
 * Wired by `NutritionTracker.tsx` to open the canonical `<LogSheet>`.
 * `onPress` is required in practice — there is no fallback behaviour.
 *
 * Tap, scale, focus per §1.1 of the production design spec.
 */
export interface LogFabProps {
  visible?: boolean;
  onPress: () => void;
  /** When `true`, the FAB renders on every viewport. Defaults to
   *  mobile-web only (`md:hidden`). */
  showOnDesktop?: boolean;
}

export function LogFab({ visible = true, onPress, showOnDesktop = false }: LogFabProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onPress}
      aria-label="Log a meal"
      title="Log a meal"
      className={[
        "fixed z-50 rounded-full shadow-[0_4px_16px_rgba(76,108,224,0.4)]",
        "bg-primary text-primary-foreground",
        "h-14 w-14 grid place-items-center",
        "transition-transform duration-150 active:scale-[0.94]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        // Position: 18px from right, 100px from bottom (same as mobile).
        // The mobile-web bottom tab bar consumes ~64pt + safe-area;
        // 100px clears it cleanly. Desktop pushes it further from the
        // edge for a more familiar floating-action placement.
        "right-[18px] bottom-[100px]",
        showOnDesktop ? "" : "md:hidden",
      ].join(" ")}
    >
      <Plus className="h-7 w-7" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

export default LogFab;
