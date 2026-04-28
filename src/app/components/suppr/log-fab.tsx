"use client";

import { Plus } from "lucide-react";

/**
 * LogFab — persistent circular Log button that lives at the
 * bottom-right of Today on mobile-web. On desktop web the FAB is
 * intentionally hidden (D-2026-04-27-11: web is the long-form
 * companion; daily macro tracking is a phone activity, so the FAB
 * lives where mobile users naturally tap).
 *
 * Authority (D-2026-04-27-15):
 *   "Persistent Log FAB on Today. One sheet with tabs:
 *    search / barcode / recent / saved / voice / photo."
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
