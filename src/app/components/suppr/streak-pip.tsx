"use client";

import * as React from "react";
import { Flame } from "lucide-react";

/**
 * StreakPip — small pill that shows the user's current logging streak
 * next to the Today date row. Web parity to
 * `apps/mobile/components/today/StreakPip.tsx`.
 *
 * Rationale (D-2026-04-27-07):
 *   "Streak shrinks to a pip; weekly recap stays as Sunday card,
 *    demoted from primary retention."
 *
 * The pip is intentionally restrained. Replaces the previous streak
 * ribbon and the inline streak chip with emoji glyph. Per V-4 in the
 * production design spec, lucide `Flame` is the canonical glyph.
 *
 * Streak < 2 renders the pip in muted neutral; ≥ 2 turns primary.
 * 0-day streaks still render so first-time users understand what the
 * surface is.
 */
export interface StreakPipProps {
  /** Current consecutive logging-day count. Always non-negative. */
  days: number;
  /** Optional accessibility hint (announced after the label). */
  ariaLabel?: string;
  /** Optional className escape hatch for callers that need to nudge
   *  vertical alignment within their own row. */
  className?: string;
}

export function StreakPip({ days, ariaLabel, className }: StreakPipProps) {
  const safeDays = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
  const active = safeDays >= 2;

  const label =
    safeDays === 0
      ? "Start your streak"
      : `${safeDays} day${safeDays === 1 ? "" : "s"}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel ?? `${safeDays}-day logging streak`}
      className={[
        "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px] font-bold leading-none tracking-[0.01em] tabular-nums",
        active
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground",
        className ?? "",
      ].join(" ")}
    >
      <Flame
        className="h-3 w-3 shrink-0"
        strokeWidth={2.25}
        aria-hidden
      />
      <span>{label}</span>
    </span>
  );
}

export default StreakPip;
