"use client";

import * as React from "react";
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
 * Phase 2 ships placement and existence only. The tap action is a
 * no-op (or whatever the caller passes) — Phase 3 wires this to the
 * canonical `<LogSheet>`.
 *
 * Tap, scale, focus per §1.1 of the production design spec.
 */
export interface LogFabProps {
  visible?: boolean;
  onPress?: () => void;
  /** When `true`, the FAB renders on every viewport. Defaults to
   *  mobile-web only (`md:hidden`). */
  showOnDesktop?: boolean;
}

export function LogFab({ visible = true, onPress, showOnDesktop = false }: LogFabProps) {
  // Hooks must be called unconditionally — declare the callback before
  // the early return so re-rendering with `visible` toggling doesn't
  // change hook order.
  const handlePress = React.useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    // Phase 2 placeholder — same alert text shape as the mobile
    // primitive for parity. Web has no native Alert API so we use
    // window.alert (this is a Phase 2 stand-in only; Phase 3 swaps
    // in the unified <LogSheet> behind the FAB).
    if (typeof window !== "undefined") {
      window.alert("Coming in Phase 3 — the unified log sheet ships in the next phase. For now, use the search / barcode / planner affordances above.");
    }
  }, [onPress]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={handlePress}
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
