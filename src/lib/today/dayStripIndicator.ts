/** Pure decision for how a single day tile renders in the Today week strip.
 *  Shared by **both** platforms — mobile `DayStrip` (`@suppr/shared/today/...`)
 *  and web `DayStrip` — so the design rule is one tested contract that can't
 *  drift between web and mobile or from the rendered components.
 *
 *  No platform deps (no React, no theme imports, no `@/` aliases) so it stays
 *  mobile-importable via the `@suppr/shared` alias and web-importable directly.
 *
 *  Selected-day treatment history:
 *    - 2026-06-03 (Grace): the SOLID filled clay pill read as clunky →
 *      minimal clay number + clay dot.
 *    - 2026-06-10 (fresh-eyes §7, full-res judge on the inverted material):
 *      the dot-only signal was a glance fail — plum reads as ink at numeral
 *      size and a 4px dot colour-swap is invisible (and a colour-blind
 *      fail). Amended to a SOFT-TINT pill (accent primarySoft wash) behind
 *      the selected number — the app's standard segment-selected grammar,
 *      materially different from the rejected SOLID pill.
 *
 *  Rules:
 *    - `selected`              → soft pill + accent number, NO dot (the pill
 *      carries selection; a dot under it double-signals)
 *    - `today` (not selected)  → accent number, no pill, no dot
 *    - `logged` (not selected) → normal number + sage dot
 *    - plain day               → normal number + no dot
 */
export type DayStripDotKind = "clay" | "sage" | "none";

export type DayStripDayState = {
  isSelected: boolean;
  isToday: boolean;
  hasLogs: boolean;
};

/**
 * The resolved indicator treatment for one day tile. Platform-agnostic: the
 * caller maps `dotKind` / `isActive` to its own colour tokens (mobile passes
 * `Accent.*`; web maps to Tailwind `text-primary` / `bg-success` classes).
 */
export type DayStripIndicator = {
  /** Which status dot (if any) sits under the number. */
  dotKind: DayStripDotKind;
  /** Whether the number is the active (clay) treatment vs a neutral day. */
  isActive: boolean;
  /** Selected day renders a soft-tint pill behind the number (§7 2026-06-10). */
  showsPill: boolean;
};

/** Resolve the indicator treatment for one day tile. Selected always wins
 *  over today and over logged. The selected pill is the SOFT tint only —
 *  callers must never apply a solid accent fill (the 2026-06-03 rejection
 *  stands for solid pills). */
export function dayStripIndicator(state: DayStripDayState): DayStripIndicator {
  const isActive = state.isSelected || state.isToday;
  const dotKind: DayStripDotKind = state.isSelected
    ? "none"
    : state.hasLogs
      ? "sage"
      : "none";
  return { dotKind, isActive, showsPill: state.isSelected };
}

/**
 * Convenience colour resolver for callers that want concrete colours (mobile).
 * Web prefers className mapping, so this is optional — kept here so the
 * colour→state mapping is also shared and testable.
 */
export type DayStripIndicatorColors = {
  /** Clay accent (#C8794E) — active day number + active dot. */
  clay: string;
  /** Sage (#5E7C5A) — "logged" status dot for non-selected days. */
  sage: string;
  /** Neutral day-number colour (theme text colour) for inactive days. */
  text: string;
  /** Soft accent tint for the selected-day pill (accent primarySoft). */
  soft: string;
};

export type DayStripIndicatorStyle = DayStripIndicator & {
  /** Resolved dot colour; "transparent" when `dotKind === "none"`. */
  dotColor: string;
  /** Day-number colour — clay when active, theme text otherwise. */
  numberColor: string;
  /** Pill background — soft tint when selected, "transparent" otherwise. */
  pillColor: string;
};

/** Resolve the full styled indicator (dot colour + number colour) for callers
 *  that style with concrete colours rather than utility classes. */
export function dayStripIndicatorStyle(
  state: DayStripDayState,
  colors: DayStripIndicatorColors,
): DayStripIndicatorStyle {
  const base = dayStripIndicator(state);
  const dotColor =
    base.dotKind === "clay"
      ? colors.clay
      : base.dotKind === "sage"
        ? colors.sage
        : "transparent";
  return {
    ...base,
    dotColor,
    numberColor: base.isActive ? colors.clay : colors.text,
    pillColor: base.showsPill ? colors.soft : "transparent",
  };
}
