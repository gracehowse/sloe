/** Pure decision for how a single day tile renders in the Today week strip.
 *  Shared by **both** platforms — mobile `DayStrip` (`@suppr/shared/today/...`)
 *  and web `DayStrip` — so the design rule is one tested contract that can't
 *  drift between web and mobile or from the rendered components.
 *
 *  No platform deps (no React, no theme imports, no `@/` aliases) so it stays
 *  mobile-importable via the `@suppr/shared` alias and web-importable directly.
 *
 *  Minimal current-day treatment (2026-06-03, Grace's feedback — the prior
 *  filled clay PILL / circle read as clunky). Julienne month-calendar
 *  language: the active day is a clay semibold NUMBER with a small clay DOT
 *  beneath, with NO filled background.
 *
 *  Rules:
 *    - `selected`              → active number + clay dot
 *    - `today` (not selected)  → active number, NO dot — stays findable by
 *      colour without a second clay dot competing with the selected day
 *    - `logged` (not selected) → normal number + sage dot
 *    - plain day               → normal number + no dot
 *    - both selected + logged  → clay precedence: ONE clay dot, never a clay +
 *      sage pair (the `selected` branch wins)
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
};

/** Resolve the indicator treatment for one day tile. Selected always wins over
 *  today and over logged (clay precedence); a day is never a filled pill — the
 *  caller must not apply a background based on selection. */
export function dayStripIndicator(state: DayStripDayState): DayStripIndicator {
  const isActive = state.isSelected || state.isToday;
  const dotKind: DayStripDotKind = state.isSelected
    ? "clay"
    : state.hasLogs
      ? "sage"
      : "none";
  return { dotKind, isActive };
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
};

export type DayStripIndicatorStyle = DayStripIndicator & {
  /** Resolved dot colour; "transparent" when `dotKind === "none"`. */
  dotColor: string;
  /** Day-number colour — clay when active, theme text otherwise. */
  numberColor: string;
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
  };
}
