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
 *      day-letter / date / dot.
 *    - 2026-07-24 (Grace): the full-fill cell reverted — too heavy. Selection
 *      fell back to ink weight alone.
 *    - 2026-07-24 (design_consistency_v1): ink weight alone was a glance fail —
 *      selection is the strip's entire job and nothing contained it. Restored a
 *      QUIET containment affordance: a 1px plum RING around the cell (the same
 *      rounded-outline idiom `ProgressWeekSection` and `PlanWeekStripV3`
 *      already use for their marked day), never a fill. The border slot is
 *      always occupied — `transparent` when unselected — so selecting a day
 *      cannot shift layout.
 *
 *  ## One meaning per channel (design_consistency_v1)
 *  The dot used to encode BOTH "has data" and "is selected" (`onAccent` = the
 *  selected-and-logged case), so neither read cleanly. Split:
 *    - RING   → selection, and only selection.
 *    - NUMBER → the day's temporal tone (selected ink / today accent / future
 *               tint / default), and only that.
 *    - DOT    → has data, and only that. One colour (sage). The `none` dot is
 *               the faint hairline tone occupying the slot, not a signal.
 *
 *  ## The flag is a real kill switch
 *  Everything above is `unifiedChrome` (`design_consistency_v1`) only. With the
 *  flag OFF this module and both components reproduce the 2026-06-24 v3
 *  treatment verbatim — plum-filled selected cell, inverted letter/number/dot,
 *  full-ink plain days, no ring, no empty-slot dot — so killing the flag lands
 *  on the surface that actually shipped, not a hybrid with no selection state.
 *
 *  ## Future days are "not yet", never "disabled"
 *  Future days are navigable (the journal range runs 30 days ahead), so the
 *  legacy blanket `opacity: .42` cell fade was a lie — it read as unavailable
 *  and was indistinguishable from the genuinely out-of-range fade. Under the
 *  flag a future day instead steps its NUMBER down to the tertiary ink tint and
 *  keeps full cell opacity. There is deliberately no weekend-specific rule.
 */

/** Which status dot sits under the number.
 *  - `sage`     — the day has logged data.
 *  - `none`     — no data; the caller renders the faint hairline placeholder so
 *                 the slot keeps its height (never an omitted element).
 *  - `onAccent` — LEGACY ONLY (`unifiedChrome: false`): the selected-and-logged
 *                 ink dot from the pre-`design_consistency_v1` conflated
 *                 semantics. Kept alive so the flag is a real kill switch. */
export type DayStripDotKind = "sage" | "onAccent" | "none";

/** Which ink tone the day NUMBER takes. The caller maps each to its own token
 *  (`text` / `accent` / `tertiary` / `secondary`). */
export type DayStripNumberTone = "selected" | "today" | "future" | "default";

export type DayStripDayState = {
  isSelected: boolean;
  isToday: boolean;
  hasLogs: boolean;
  /** Day falls after today but is still inside the journal range — navigable,
   *  NOT disabled. Optional: callers that don't distinguish future days (or
   *  that run with the flag off) can omit it. */
  isFuture?: boolean;
  /** `design_consistency_v1`. `true` → ring selection + single-meaning dot +
   *  future tint. `false` → the legacy pre-flag treatment (no ring, conflated
   *  `onAccent` dot, blanket future-cell opacity fade). */
  unifiedChrome?: boolean;
};

/**
 * The resolved indicator treatment for one day tile. Platform-agnostic: the
 * caller maps `numberTone` / `dotKind` / `selectedRing` to its own colour
 * tokens (mobile passes `Accent.*` via `dayStripIndicatorStyle`; web maps to
 * Tailwind classes).
 */
export type DayStripIndicator = {
  /** Which status dot (if any) sits under the number — see `DayStripDotKind`. */
  dotKind: DayStripDotKind;
  /** Draw the 1px plum containment ring around the whole cell. Only ever true
   *  under `unifiedChrome`; the legacy path has no ring. */
  selectedRing: boolean;
  /** LEGACY ONLY (`unifiedChrome: false`): the 2026-06-24 v3 prototype
   *  `.day-cell.is-sel` — the whole cell floods plum and the day letter /
   *  number / dot invert to the on-accent tone. Always `false` under
   *  `unifiedChrome` (the ring contains, it never floods). Kept live so
   *  flipping the flag off restores exactly what shipped before it, instead of
   *  a hybrid with NO selection affordance at all — a kill switch that lands
   *  you somewhere the product has never been is not a kill switch. */
  selectedFill: boolean;
  /** Ink tone for the day number — see `DayStripNumberTone`. Note `"default"`
   *  resolves differently per path (legacy = full ink, `unifiedChrome` =
   *  secondary); `dayStripIndicatorStyle` reads `state.unifiedChrome` to pick. */
  numberTone: DayStripNumberTone;
  /** LEGACY ONLY: drop the whole cell's opacity because the day is in the
   *  future. Always `false` under `unifiedChrome` — a future day is "not yet",
   *  carried by `numberTone: "future"`, not by a disabled-looking fade. */
  dimFutureCell: boolean;
};

/** Resolve the indicator treatment for one day tile. Selection always wins over
 *  today, and today over future; the dot is independent of all three under
 *  `unifiedChrome`. */
export function dayStripIndicator(state: DayStripDayState): DayStripIndicator {
  const unified = state.unifiedChrome ?? false;
  const isFuture = state.isFuture ?? false;

  const numberTone: DayStripNumberTone = state.isSelected
    ? "selected"
    : state.isToday
      ? "today"
      : unified && isFuture
        ? "future"
        : "default";

  if (!unified) {
    // Legacy (flag OFF): the dot carries BOTH "logged" and "selected", and a
    // future day fades its whole cell.
    return {
      dotKind: state.isSelected
        ? state.hasLogs
          ? "onAccent"
          : "none"
        : state.hasLogs
          ? "sage"
          : "none",
      selectedRing: false,
      selectedFill: state.isSelected,
      numberTone,
      dimFutureCell: isFuture,
    };
  }

  return {
    // One meaning per channel: the dot is "has data", nothing else.
    dotKind: state.hasLogs ? "sage" : "none",
    selectedRing: state.isSelected,
    selectedFill: false,
    numberTone,
    dimFutureCell: false,
  };
}

/**
 * Concrete colour resolver for callers that style with values rather than
 * utility classes (mobile). Web prefers className mapping, so this is optional
 * — kept here so the tone→colour mapping is also shared and testable.
 */
export type DayStripIndicatorColors = {
  /** Plum accent (#5B3B6E) — the today-not-selected number AND the selected
   *  containment ring. */
  accent: string;
  /** Sage (#5E7C5A) — the "has data" dot. */
  sage: string;
  /** Full ink — the selected day's number. */
  text: string;
  /** Secondary ink — every past/present day that is neither selected nor
   *  today. */
  secondary: string;
  /** Tertiary ink tint — a FUTURE day's number ("not yet", not "disabled"). */
  tertiary: string;
  /** Faint hairline tone for the no-data dot slot — never the mid-grey
   *  tertiary, which read as a hard dot on all seven days. Callers on the
   *  legacy path pass `"transparent"` (the pre-flag strip had no empty slot). */
  emptyDot: string;
  /** LEGACY ONLY: on-accent ink (white) for the filled cell's number and its
   *  `onAccent` dot. Optional — callers that only ever run the `unifiedChrome`
   *  path never need it, and it falls back to `text`. */
  onAccent?: string;
};

export type DayStripIndicatorStyle = DayStripIndicator & {
  /** Day-number colour resolved from `numberTone`. */
  numberColor: string;
  /** Resolved dot colour; the faint `emptyDot` tone when `dotKind === "none"`. */
  dotColor: string;
  /** 1px cell ring colour — `accent` when selected, else `"transparent"`. The
   *  border slot is always occupied so selection can't shift layout. */
  ringColor: string;
  /** LEGACY ONLY: whole-cell background — `accent` under `selectedFill`, else
   *  `"transparent"`. Always `"transparent"` under `unifiedChrome`. */
  cellBg: string;
};

/** Resolve the full styled indicator (ring + fill + number colour + dot colour). */
export function dayStripIndicatorStyle(
  state: DayStripDayState,
  colors: DayStripIndicatorColors,
): DayStripIndicatorStyle {
  const base = dayStripIndicator(state);
  const unified = state.unifiedChrome ?? false;
  const onAccent = colors.onAccent ?? colors.text;
  const dotColor =
    base.dotKind === "sage"
      ? colors.sage
      : base.dotKind === "onAccent"
        ? onAccent
        : colors.emptyDot;
  // The filled legacy cell inverts its numeral; otherwise tone drives colour.
  // `default` is the one tone that differs per path: the pre-flag strip drew
  // every plain day in FULL ink, `unifiedChrome` steps it back to secondary so
  // selection/today/future have somewhere to stand out from.
  const numberColor = base.selectedFill
    ? onAccent
    : base.numberTone === "selected"
      ? colors.text
      : base.numberTone === "today"
        ? colors.accent
        : base.numberTone === "future"
          ? colors.tertiary
          : unified
            ? colors.secondary
            : colors.text;
  return {
    ...base,
    numberColor,
    dotColor,
    ringColor: base.selectedRing ? colors.accent : "transparent",
    cellBg: base.selectedFill ? colors.accent : "transparent",
  };
}
