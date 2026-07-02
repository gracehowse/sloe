"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { SupprButton } from "./suppr-button";
import { cn } from "../ui/utils";

/**
 * QuickLogButton — the compact secondary "Log" action on suggestion surfaces
 * (ENG-1301, VERIFIED V13). The north-star CTA and Coach candidate rows used
 * to route ONLY to /recipe/[id]; this commits the suggested recipe to the
 * suggested slot in one tap instead. Presentation-only: the host owns the
 * journal insert (reusing `addLoggedMealForDate` — no new logging path) and
 * the standard success feedback (toast); this component owns the async press
 * state (disable + spinner — no double-submit).
 *
 * Appearances:
 *   - `ghost`   — the canonical secondary (2026-06-12 button system):
 *     SupprButton variant="ghost", compact footprint. For card/row surfaces.
 *   - `onImage` — dark scrim pill for the full-bleed Figma hero, matching the
 *     sibling skip-button grammar (`bg-black/30` on-photo).
 *
 * Mobile mirror: `apps/mobile/components/ui/QuickLogButton.tsx`.
 */
export function QuickLogButton({
  onLog,
  appearance = "ghost",
  ariaLabel,
  testID,
  className,
}: {
  /** Host-owned quick-log commit. Awaited; the button disables + shows a
   *  spinner until it settles. */
  onLog: () => Promise<void> | void;
  appearance?: "ghost" | "onImage";
  /** e.g. "Log Chicken salad". */
  ariaLabel: string;
  testID?: string;
  className?: string;
}) {
  const [logging, setLogging] = React.useState(false);
  const handleClick = React.useCallback(async () => {
    if (logging) return;
    setLogging(true);
    try {
      await onLog();
    } finally {
      setLogging(false);
    }
  }, [logging, onLog]);

  if (appearance === "onImage") {
    return (
      <button
        type="button"
        data-testid={testID}
        aria-label={ariaLabel}
        aria-busy={logging || undefined}
        disabled={logging}
        onClick={() => void handleClick()}
        className={cn(
          // Same on-photo scrim treatment as the sibling figma skip button.
          "inline-flex items-center justify-center rounded-full bg-black/30 px-4 py-2",
          "text-sm font-semibold text-white hover:bg-black/45 disabled:opacity-70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          className,
        )}
      >
        {logging ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          "Log"
        )}
      </button>
    );
  }

  return (
    <SupprButton
      variant="ghost"
      data-testid={testID}
      aria-label={ariaLabel}
      loading={logging}
      onClick={() => void handleClick()}
      className={cn("h-9 px-4 self-start", className)}
    >
      Log
    </SupprButton>
  );
}

export default QuickLogButton;
