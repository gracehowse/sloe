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
 *    - 2026-06-10 (fresh-eyes §7): the dot-only signal was a glance fail →
 *      a SOFT-TINT pill (accent primarySoft wash) behind the selected number.
 *    - 2026-06-24 (ENG-1247, v3 prototype is canonical): conform to the
 *      prototype `.day-cell.is-sel` — a FULL plum-filled cell with WHITE
 *      day-letter / date / dot. This supersedes the soft-tint pill: the
 *      prototype's filled cell is plum + white (a clean inversion), NOT the
 *      clay-on-tint solid pill rejected in 2026-06-03, and the prototype is
 *      now the source of truth (Grace 2026-06-24, Figma retired).
 *
 *  Rules:
 *    - `selected`              → FULL accent-filled cell, white number, white
 *      dot only when the day is also logged (else no dot — the fill carries
 *      selection)
 *    - `today` (not selected)  → accent number, no fill, no dot
 *    - `logged` (not selected) → normal number + sage dot
 *    - plain day               → normal number + no dot
 */
export type DayStripDotKind = "sage" | "onAccent" | "none";

export type DayStripDayState = {
  isSelected: boolean;
  isToday: boolean;
  hasLogs: boolean;
};

/**
 * The resolved indicator treatment for one day tile. Platform-agnostic: the
 * caller maps `dotKind` / `isActive` / `selectedFill` to its own colour tokens
 * (mobile passes `Accent.*`; web maps to Tailwind classes).
 */
export type DayStripIndicator = {
  /** Which status dot (if any) sits under the number: `sage` = logged day,
   *  `onAccent` = white dot on the selected plum fill, `none` = hidden. */
  dotKind: DayStripDotKind;
  /** Whether the number is the active (accent) treatment vs a neutral day.
   *  Only true for today-when-not-selected — the selected cell uses the white
   *  on-accent treatment instead, not the accent number. */
  isActive: boolean;
  /** Selected day fills the WHOLE cell with the solid accent (plum) and inverts
   *  its text/dot to white (v3 prototype `.is-sel`, 2026-06-24). */
  selectedFill: boolean;
};

/** Resolve the indicator treatment for one day tile. Selected always wins over
 *  today and over logged. The selected cell is the FULL plum fill (white text)
 *  per the v3 prototype — callers must apply `cellBg` to the whole cell, not a
 *  number-only pill. */
export function dayStripIndicator(state: DayStripDayState): DayStripIndicator {
  const selectedFill = state.isSelected;
  // The selected cell uses the white on-accent treatment, so the accent
  // NUMBER treatment is reserved for today-when-not-selected.
  const isActive = state.isToday && !state.isSelected;
  const dotKind: DayStripDotKind = state.isSelected
    ? state.hasLogs
      ? "onAccent"
      : "none"
    : state.hasLogs
      ? "sage"
      : "none";
  return { dotKind, isActive, selectedFill };
}

/**
 * Convenience colour resolver for callers that want concrete colours (mobile).
 * Web prefers className mapping, so this is optional — kept here so the
 * colour→state mapping is also shared and testable.
 */
export type DayStripIndicatorColors = {
  /** Plum accent (#3B2A4D) — the selected-cell fill + active day number. */
  accent: string;
  /** Sage (#5E7C5A) — "logged" status dot for non-selected days. */
  sage: string;
  /** Neutral day-number colour (theme text colour) for inactive days. */
  text: string;
  /** On-accent colour (white) — the day-letter / number / dot on the plum fill. */
  onAccent: string;
};

export type DayStripIndicatorStyle = DayStripIndicator & {
  /** Whole-cell background — accent (plum) when selected, "transparent" else. */
  cellBg: string;
  /** Day-number colour — onAccent (white) when selected, accent when today,
   *  theme text otherwise. */
  numberColor: string;
  /** Resolved dot colour; "transparent" when `dotKind === "none"`. */
  dotColor: string;
};

/** Resolve the full styled indicator (cell fill + number colour + dot colour)
 *  for callers that style with concrete colours rather than utility classes. */
export function dayStripIndicatorStyle(
  state: DayStripDayState,
  colors: DayStripIndicatorColors,
): DayStripIndicatorStyle {
  const base = dayStripIndicator(state);
  const dotColor =
    base.dotKind === "onAccent"
      ? colors.onAccent
      : base.dotKind === "sage"
        ? colors.sage
        : "transparent";
  const numberColor = base.selectedFill
    ? colors.onAccent
    : base.isActive
      ? colors.accent
      : colors.text;
  return {
    ...base,
    cellBg: base.selectedFill ? colors.accent : "transparent",
    numberColor,
    dotColor,
  };
}
