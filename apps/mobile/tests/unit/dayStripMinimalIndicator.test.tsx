// @vitest-environment jsdom
/**
 * DayStrip — selected-day indicator (design_consistency_v1, 2026-07-24).
 *
 * The whole-app design critique found the strip had NO selection state: the
 * selected day differed only in ink weight, and the dot conflated "has data"
 * with "is selected". This pins the fix — one meaning per channel:
 *
 *   RING   → selection, and only selection. A 1px plum outline tight around
 *            the numeral (the rounded-outline idiom `ProgressWeekSection`
 *            already uses), never a fill — the 2026-06-24 plum-filled cell and
 *            the 2026-06-10 soft-tint pill were both reverted as too heavy.
 *            The border slot is always occupied (transparent when unselected)
 *            so selecting a day cannot shift layout.
 *   NUMBER → temporal tone only: selected = full ink, today = accent,
 *            FUTURE = tertiary tint ("not yet", NOT the old blanket
 *            `opacity: .42` cell fade that read as "disabled" on a navigable
 *            day), everything else = secondary.
 *   DOT    → has data, and only that. One colour (sage). No `onAccent`.
 *
 * Flag OFF keeps the pre-flag treatment alive as the kill switch, so both
 * branches are pinned here. Web twin: `tests/unit/dayStripMinimalIndicatorWeb`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import DayStrip from "../../components/charts/DayStrip";
import {
  dayStripIndicator,
  dayStripIndicatorStyle,
  type DayStripIndicatorColors,
} from "@suppr/shared/today/dayStripIndicator";
import { Accent } from "../../constants/theme";
import { dateKeyFromDate } from "../../lib/nutritionJournal";

void React;

const EMPTY_DOT = "#EAE7F0";
const TEXT = "#1A1A1A";
const SECONDARY = "#8A8A8A";
const TERTIARY = "#B5B2BD";

const COLORS: DayStripIndicatorColors = {
  accent: Accent.primary,
  sage: Accent.success,
  text: TEXT,
  secondary: SECONDARY,
  tertiary: TERTIARY,
  emptyDot: EMPTY_DOT,
};

/** Resolve with design_consistency_v1 ON (the shipped path). */
function unified(
  state: {
    isSelected: boolean;
    isToday: boolean;
    hasLogs: boolean;
    isFuture?: boolean;
  },
) {
  return dayStripIndicatorStyle({ ...state, unifiedChrome: true }, COLORS);
}

describe("dayStripIndicator — selection is the ring, nothing else", () => {
  it("selected day: plum ring, full-ink number, faint dot when unlogged", () => {
    const out = unified({ isSelected: true, isToday: false, hasLogs: false });
    expect(out.selectedRing).toBe(true);
    expect(out.ringColor).toBe(Accent.primary);
    expect(out.numberTone).toBe("selected");
    expect(out.numberColor).toBe(TEXT);
    expect(out.dotKind).toBe("none");
    expect(out.dotColor).toBe(EMPTY_DOT);
  });

  it("selected AND logged: the dot stays SAGE — it means data, not selection", () => {
    const out = unified({ isSelected: true, isToday: false, hasLogs: true });
    // The conflated `onAccent` kind is gone: selection is carried by the ring
    // alone, so a logged day reads identically logged whether or not it is the
    // selected one.
    expect(out.dotKind).toBe("sage");
    expect(out.dotColor).toBe(Accent.success);
    expect(out.selectedRing).toBe(true);
    expect(out.numberColor).toBe(TEXT);
  });

  it("a logged day's dot is identical selected vs not (one meaning per channel)", () => {
    const sel = unified({ isSelected: true, isToday: false, hasLogs: true });
    const unsel = unified({ isSelected: false, isToday: false, hasLogs: true });
    expect(sel.dotKind).toBe(unsel.dotKind);
    expect(sel.dotColor).toBe(unsel.dotColor);
    // …and the ring is the ONLY thing that differs in the selection channel.
    expect(sel.selectedRing).toBe(true);
    expect(unsel.selectedRing).toBe(false);
    expect(unsel.ringColor).toBe("transparent");
  });

  it("today (not selected): accent number, no ring", () => {
    const out = unified({ isSelected: false, isToday: true, hasLogs: false });
    expect(out.numberTone).toBe("today");
    expect(out.numberColor).toBe(Accent.primary);
    expect(out.selectedRing).toBe(false);
    expect(out.ringColor).toBe("transparent");
    expect(out.dotKind).toBe("none");
  });

  it("selected + today + logged: selection wins the ring, dot stays sage", () => {
    const out = unified({ isSelected: true, isToday: true, hasLogs: true });
    expect(out.selectedRing).toBe(true);
    expect(out.numberTone).toBe("selected");
    expect(out.numberColor).toBe(TEXT);
    expect(out.dotKind).toBe("sage");
  });

  it("plain past day: secondary number, faint dot, no ring", () => {
    const out = unified({ isSelected: false, isToday: false, hasLogs: false });
    expect(out.numberTone).toBe("default");
    expect(out.numberColor).toBe(SECONDARY);
    expect(out.dotKind).toBe("none");
    expect(out.dotColor).toBe(EMPTY_DOT);
    expect(out.selectedRing).toBe(false);
  });
});

describe("future days read 'not yet', never 'disabled'", () => {
  it("future day: tertiary TINT on the number, and NO cell-opacity fade", () => {
    const out = unified({
      isSelected: false,
      isToday: false,
      hasLogs: false,
      isFuture: true,
    });
    expect(out.numberTone).toBe("future");
    expect(out.numberColor).toBe(TERTIARY);
    // The blanket 0.42 cell fade is what made a navigable day look unavailable.
    expect(out.dimFutureCell).toBe(false);
  });

  it("a future day is LIGHTER than a past day but still an ink tone", () => {
    const past = unified({ isSelected: false, isToday: false, hasLogs: false });
    const future = unified({
      isSelected: false,
      isToday: false,
      hasLogs: false,
      isFuture: true,
    });
    expect(future.numberColor).not.toBe(past.numberColor);
    expect(future.numberColor).toBe(TERTIARY);
    expect(past.numberColor).toBe(SECONDARY);
  });

  it("selection and today still beat the future tint", () => {
    const selectedFuture = unified({
      isSelected: true,
      isToday: false,
      hasLogs: false,
      isFuture: true,
    });
    expect(selectedFuture.numberTone).toBe("selected");
    expect(selectedFuture.selectedRing).toBe(true);
  });

  it("there is no weekend rule — weekday identity never changes the tone", () => {
    // The decision takes no day-of-week input at all, so a Saturday and a
    // Wednesday in the same state are byte-identical by construction.
    const a = unified({ isSelected: false, isToday: false, hasLogs: false });
    const b = unified({ isSelected: false, isToday: false, hasLogs: false });
    expect(a).toStrictEqual(b);
  });
});

describe("flag OFF — the pre-flag treatment survives as the kill switch", () => {
  it("keeps the conflated onAccent dot and the future-cell fade", () => {
    const legacySelectedLogged = dayStripIndicator({
      isSelected: true,
      isToday: false,
      hasLogs: true,
      unifiedChrome: false,
    });
    expect(legacySelectedLogged.dotKind).toBe("onAccent");
    expect(legacySelectedLogged.selectedRing).toBe(false);

    const legacyFuture = dayStripIndicator({
      isSelected: false,
      isToday: false,
      hasLogs: false,
      isFuture: true,
      unifiedChrome: false,
    });
    expect(legacyFuture.dimFutureCell).toBe(true);
    expect(legacyFuture.numberTone).toBe("default");
  });

  it("defaults to the legacy path when `unifiedChrome` is omitted", () => {
    const out = dayStripIndicator({
      isSelected: true,
      isToday: false,
      hasLogs: true,
    });
    expect(out.selectedRing).toBe(false);
    expect(out.dotKind).toBe("onAccent");
  });
});

/** Flatten a possibly-nested RN style prop into one object. */
function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  return (style as Record<string, unknown>) ?? {};
}

describe("DayStrip render — ring present, no cell fill", () => {
  function renderStrip(loggedDays: Set<string>) {
    const today = new Date();
    const utils = render(
      <DayStrip
        selectedDate={today}
        weekStartDay="monday"
        loggedDays={loggedDays}
        onSelectDate={() => undefined}
        onOpenCalendar={() => undefined}
        textColor={TEXT}
        secondaryColor={SECONDARY}
        tertiaryColor={TERTIARY}
      />,
    );
    // The week pages only render once the pager has a measured width — fire a
    // layout event so the FlatList mounts its day tiles.
    const pager = utils.getByTestId("daystrip-pager");
    fireEvent(pager, "layout", {
      nativeEvent: { layout: { width: 320, height: 64, x: 0, y: 0 } },
    });
    return utils;
  }

  it("renders minimal dot testIDs and NO cell carries a fill", () => {
    const utils = renderStrip(new Set<string>());

    // The minimal-indicator dots exist in the tree (the redesigned render path).
    const dots = utils.queryAllByTestId(/^daystrip-dot-minimal-/);
    expect(dots.length).toBeGreaterThan(0);

    // Selection is a RING, never a fill. Find day-cell Pressables by their
    // signature (paddingVertical:8 + alignItems:center + gap:4) and assert none
    // carries a background.
    const allNodes = utils.UNSAFE_root.findAll(() => true);
    const dayCells = allNodes.filter((node) => {
      const style = flattenStyle((node.props as { style?: unknown })?.style);
      return (
        style.paddingVertical === 8 &&
        style.alignItems === "center" &&
        style.gap === 4
      );
    });
    expect(dayCells.length).toBeGreaterThan(0);
    // `findAll` returns BOTH the composite Pressable and its host View per
    // cell, so filter to host nodes to count each cell once.
    const filled = dayCells.filter((cell) => {
      if (typeof (cell as { type?: unknown }).type !== "string") return false;
      const style = flattenStyle((cell.props as { style?: unknown })?.style);
      const bg = style.backgroundColor;
      return typeof bg === "string" && bg !== "transparent";
    });
    expect(filled).toHaveLength(0);
  });

  it("draws exactly one selection ring, and it is not transparent", () => {
    const utils = renderStrip(new Set<string>());
    const rings = utils
      .queryAllByTestId("daystrip-selected-ring")
      .filter((n) => typeof (n as { type?: unknown }).type === "string");
    expect(rings).toHaveLength(1);
    const style = flattenStyle((rings[0]!.props as { style?: unknown })?.style);
    expect(style.borderWidth).toBe(1);
    expect(style.borderColor).not.toBe("transparent");
  });

  it("marks the selected cell selected for VoiceOver", () => {
    const utils = renderStrip(new Set<string>());
    const selected = utils.UNSAFE_root.findAll((node) => {
      const state = (node.props as { accessibilityState?: { selected?: boolean } })
        ?.accessibilityState;
      return state?.selected === true;
    });
    expect(selected.length).toBeGreaterThanOrEqual(1);
  });

  it("today's (selected, unlogged) tile renders the faint 'none' dot", () => {
    const utils = renderStrip(new Set<string>());
    const noneDots = utils.queryAllByTestId("daystrip-dot-minimal-none");
    expect(noneDots.length).toBeGreaterThanOrEqual(1);
  });

  it("a logged (non-selected) day renders a sage dot", () => {
    // Pick yesterday as a logged day so it is logged but not selected/today.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const utils = renderStrip(new Set<string>([dateKeyFromDate(yesterday)]));

    const sageDots = utils.queryAllByTestId("daystrip-dot-minimal-sage");
    expect(sageDots.length).toBeGreaterThanOrEqual(1);
  });

  it("the SELECTED logged day also renders a sage dot (no onAccent kind)", () => {
    const utils = renderStrip(new Set<string>([dateKeyFromDate(new Date())]));
    expect(
      utils.queryAllByTestId("daystrip-dot-minimal-sage").length,
    ).toBeGreaterThanOrEqual(1);
    expect(utils.queryAllByTestId("daystrip-dot-minimal-onAccent")).toHaveLength(0);
  });

  it("exposes the week chevrons (prototype `.day-nav`)", () => {
    const utils = renderStrip(new Set<string>());
    expect(utils.getByLabelText("Previous week")).toBeTruthy();
    expect(utils.getByLabelText("Next week")).toBeTruthy();
  });
});

// keep the vi import meaningful even if no spies are needed
void vi;
