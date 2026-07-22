"use client";

import * as React from "react";
import { Flame, Shield } from "lucide-react";

/**
 * StreakPip — small pill that shows the user's current logging streak
 * next to the Today date row.
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
 * A 0-day streak with no freeze protection renders nothing (empty-state
 * suppressed — `premium-sweep-v2-p0-t26` collapsed permanently on,
 * ENG-1651). A 0-day streak WITH freeze protection still renders.
 *
 * KNOWN WEB/MOBILE DIVERGENCE (flagged, not silently left — ENG-1651):
 * mobile's `apps/mobile/components/today/StreakPip.tsx` explicitly does
 * the opposite — it documents "we do NOT hide a 0-day streak — the
 * pip's persistent presence is part of the calm-streak posture." This
 * predates the flag collapse (the flag was always web-only), so
 * collapsing it just removed the only mechanism that could have
 * reverted web back to mobile's behavior. Whether these two should
 * actually match is an open product question, not resolved here.
 *
 * 2026-05-12 (premium-bar audit web parity, DC8 polish):
 *   - `freezeProtected` swaps the Flame → Shield + calm slate when a
 *     freeze covered today's logging gap. Headspace parity.
 *   - `onPress` makes the pip tappable (opens /whats-new or other
 *     destination supplied by the host).
 *   - `size` lifts the pill to 28pt for headline placements (e.g.
 *     above the weekly recap card).
 */
export interface StreakPipProps {
  /** Current consecutive logging-day count. Always non-negative. */
  days: number;
  /** Optional accessibility hint (announced after the label). */
  ariaLabel?: string;
  /** Optional className escape hatch for callers that need to nudge
   *  vertical alignment within their own row. */
  className?: string;
  /** 2026-05-12 — when supplied, the pip becomes a `<button>` and
   *  the accessibility role flips from status → button. Use to wire
   *  a destination (typically `/whats-new` or a weekly-recap dialog). */
  onPress?: () => void;
  /** 2026-05-12 — render at headline size (28pt) for recap header
   *  placements. Default is the compact 22pt pill. */
  size?: "sm" | "lg";
  /** 2026-05-12 — DC8 polish (Headspace freeze-shield): when today's
   *  streak is being kept alive by a stocked freeze, swap the
   *  `Flame` glyph for `Shield` and tint to a calm slate so the
   *  message reads "a freeze covered for you", not "you fired
   *  today". */
  freezeProtected?: boolean;
}

export function StreakPip({
  days,
  ariaLabel,
  className,
  onPress,
  size = "sm",
  freezeProtected = false,
}: StreakPipProps) {
  const safeDays = Number.isFinite(days) && days >= 0 ? Math.floor(days) : 0;
  const active = safeDays >= 2;
  const isLg = size === "lg";

  // No streak yet: suppress the pip entirely -- the empty-state "Start
  // your streak" copy reads as growth-shouty pressure and violates calm
  // voice. (premium-sweep-v2-p0-t26, collapsed permanently-on 2026-07-21.)
  if (safeDays === 0 && !freezeProtected) {
    return null;
  }

  const streakLabel = (d: number): string => {
    if (d === 0) return "Start your streak";
    if (d === 7) return "1 week streak";
    if (d === 14) return "2 week streak";
    if (d === 21) return "3 week streak";
    if (d === 30) return "1 month streak";
    if (d === 60) return "2 month streak";
    if (d === 90) return "3 month streak";
    if (d === 100) return "100 day streak!";
    if (d === 365) return "1 year streak!";
    return `${d}-day streak`;
  };

  const label = freezeProtected
    ? `${safeDays}-day streak · freeze`
    : streakLabel(safeDays);

  const baseAria = freezeProtected
    ? `${safeDays}-day streak — freeze used today`
    : `${safeDays}-day logging streak`;
  const finalAria = onPress
    ? `${ariaLabel ?? baseAria} — tap for weekly recap`
    : (ariaLabel ?? baseAria);

  const isMilestone = [7, 14, 21, 30, 60, 90, 100, 365].includes(safeDays);
  // ENG-716 — milestone tone migrated off the raw Tailwind `amber-*` literals
  // onto the Sloe `warning` semantic tokens (`-soft` fill + `-solid` text, with
  // dark-mode auto-swap replacing the hand-rolled `dark:` overrides). The token
  // resolves a touch more desaturated than the old raw amber — a calmer
  // milestone fill Grace signed off to ship UNFLAGGED (2026-06-19; low-traffic
  // surface, per the flag rule's explicit sign-off path).
  // Parity note: this milestone tone is web-only. The mobile twin
  // (`apps/mobile/components/today/StreakPip.tsx`) renders NO distinct milestone
  // tone, so there is no counterpart to mirror — a pre-existing gap that predates
  // this token swap, not a divergence introduced here.
  const toneClass = freezeProtected
    ? "bg-muted text-muted-foreground"
    : isMilestone
      ? "bg-warning-soft text-warning-solid"
      : active
        ? "bg-primary/10 text-primary-solid"
        : "bg-muted text-muted-foreground";

  const sizeClass = isLg
    ? "h-7 px-3 text-[13px] gap-1.5"
    : "h-[22px] px-2 text-[11px] gap-1";

  const Glyph = freezeProtected ? Shield : Flame;

  const inner = (
    <>
      <Glyph
        className={isLg ? "h-3.5 w-3.5 shrink-0" : "h-3 w-3 shrink-0"}
        strokeWidth={2.25}
        aria-hidden
      />
      <span>{label}</span>
    </>
  );

  const baseClass = [
    "inline-flex items-center rounded-full font-bold leading-none tracking-[0.01em] tabular-nums",
    sizeClass,
    toneClass,
    className ?? "",
  ].join(" ");

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        aria-label={finalAria}
        className={`${baseClass} hover:opacity-80 transition-opacity`}
      >
        {inner}
      </button>
    );
  }

  return (
    <span role="status" aria-label={finalAria} className={baseClass}>
      {inner}
    </span>
  );
}

export default StreakPip;
