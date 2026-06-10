// @vitest-environment jsdom
/**
 * DayStrip — minimal current-day indicator (2026-06-03, Grace's feedback).
 *
 * The Today week strip used to mark the selected/today day with a clay FILLED
 * PILL behind the whole cell. Grace found it clunky and asked for the
 * Julienne-minimal treatment: the active day = clay (#C8794E) semibold NUMBER
 * with a small clay DOT beneath, NO filled background. Logged days keep a sage
 * status dot; when a day is BOTH selected and logged the clay indicator wins
 * (one clay dot, never a clay + sage pair).
 *
 * Two layers are pinned here:
 *   1. `dayStripIndicator` — the pure state→treatment decision the component
 *      consumes. This is the load-bearing contract: number colour/weight, dot
 *      kind, dot colour, and clay precedence for every state combination.
 *   2. The rendered `DayStrip` — structural guard that no day cell carries a
 *      filled clay background (the pill is gone) and that the new minimal dot
 *      testIDs are present in the tree.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import DayStrip from "../../components/charts/DayStrip";
import {
  dayStripIndicatorStyle as dayStripIndicator,
  type DayStripIndicatorColors,
} from "@suppr/shared/today/dayStripIndicator";
import { Accent } from "../../constants/theme";
import { dateKeyFromDate } from "../../lib/nutritionJournal";

void React;

const COLORS: DayStripIndicatorColors = {
  clay: Accent.primary,
  sage: Accent.success,
  text: "#1A1A1A",
};

describe("dayStripIndicator — pure state→treatment decision", () => {
  it("selected day: clay number (bold) + clay dot, no pill", () => {
    const out = dayStripIndicator(
      { isSelected: true, isToday: false, hasLogs: false },
      COLORS,
    );
    expect(out.dotKind).toBe("clay");
    expect(out.dotColor).toBe(Accent.primary);
    expect(out.numberColor).toBe(Accent.primary);
    expect(out.isActive).toBe(true);
  });

  it("today (not selected): clay number, NO dot — findable without a second clay dot", () => {
    const out = dayStripIndicator(
      { isSelected: false, isToday: true, hasLogs: false },
      COLORS,
    );
    expect(out.numberColor).toBe(Accent.primary);
    expect(out.isActive).toBe(true);
    // today-not-selected must not draw a dot — only the selected day gets one
    expect(out.dotKind).toBe("none");
    expect(out.dotColor).toBe("transparent");
  });

  it("logged (not selected): sage dot, neutral number", () => {
    const out = dayStripIndicator(
      { isSelected: false, isToday: false, hasLogs: true },
      COLORS,
    );
    expect(out.dotKind).toBe("sage");
    expect(out.dotColor).toBe(Accent.success);
    expect(out.numberColor).toBe(COLORS.text);
    expect(out.isActive).toBe(false);
  });

  it("plain day: no dot, neutral semibold number", () => {
    const out = dayStripIndicator(
      { isSelected: false, isToday: false, hasLogs: false },
      COLORS,
    );
    expect(out.dotKind).toBe("none");
    expect(out.dotColor).toBe("transparent");
    expect(out.numberColor).toBe(COLORS.text);
    expect(out.isActive).toBe(false);
  });

  it("both selected AND logged: clay precedence — ONE clay dot, never sage", () => {
    const out = dayStripIndicator(
      { isSelected: true, isToday: false, hasLogs: true },
      COLORS,
    );
    expect(out.dotKind).toBe("clay");
    expect(out.dotColor).toBe(Accent.primary);
    // the sage "logged" dot must NOT win when the day is also selected
    expect(out.dotColor).not.toBe(Accent.success);
  });

  it("selected + today + logged: still clay, still one dot", () => {
    const out = dayStripIndicator(
      { isSelected: true, isToday: true, hasLogs: true },
      COLORS,
    );
    expect(out.dotKind).toBe("clay");
    expect(out.numberColor).toBe(Accent.primary);
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

describe("DayStrip render — no filled pill, minimal dots present", () => {
  function renderStrip(loggedDays: Set<string>) {
    const today = new Date();
    const utils = render(
      <DayStrip
        selectedDate={today}
        weekStartDay="monday"
        loggedDays={loggedDays}
        onSelectDate={() => undefined}
        onOpenCalendar={() => undefined}
        textColor="#1A1A1A"
        secondaryColor="#8A8A8A"
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

  it("renders minimal dot testIDs and NO day cell has a clay filled background", () => {
    const utils = renderStrip(new Set<string>());

    // The new minimal-indicator dots exist in the tree (proves the redesigned
    // render path is live, not the old pill path).
    const dots = utils.queryAllByTestId(/^daystrip-dot-minimal-/);
    expect(dots.length).toBeGreaterThan(0);

    // Structural guard: the old treatment set `backgroundColor: Accent.primary`
    // on the selected day Pressable (the filled pill) — a tall cell with
    // vertical padding + a border radius. The new clay status DOT legitimately
    // uses Accent.primary as its background, so we exclude the 4x4 dots and
    // assert no *cell-shaped* element carries the clay fill any more.
    const allNodes = utils.UNSAFE_root.findAll(() => true);
    const clayPills = allNodes.filter((node) => {
      const style = flattenStyle((node.props as { style?: unknown })?.style);
      if (style.backgroundColor !== Accent.primary) return false;
      // the clay dot is 4x4 — not a pill; everything else with a clay fill is
      const isTinyDot = style.width === 4 && style.height === 4;
      return !isTinyDot;
    });
    expect(clayPills).toHaveLength(0);

    // Belt-and-braces: the day-cell Pressables must have NO backgroundColor at
    // all (the pill is gone). Find cells by their day-cell signature
    // (paddingVertical:8 + alignItems:center + gap:5) and assert none fills.
    const dayCells = allNodes.filter((node) => {
      const style = flattenStyle((node.props as { style?: unknown })?.style);
      return (
        style.paddingVertical === 8 &&
        style.alignItems === "center" &&
        style.gap === 5
      );
    });
    expect(dayCells.length).toBeGreaterThan(0);
    for (const cell of dayCells) {
      const style = flattenStyle((cell.props as { style?: unknown })?.style);
      expect(style.backgroundColor).toBeUndefined();
    }
  });

  it("today's tile renders a clay dot when today is the selected date", () => {
    const utils = renderStrip(new Set<string>());
    // selectedDate is today, so at least one clay dot must render.
    const clayDots = utils.queryAllByTestId("daystrip-dot-minimal-clay");
    expect(clayDots.length).toBeGreaterThanOrEqual(1);
  });

  it("a logged (non-selected) day renders a sage dot, not a clay one", () => {
    // Pick yesterday as a logged day so it is logged but not selected/today.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const utils = renderStrip(new Set<string>([dateKeyFromDate(yesterday)]));

    const sageDots = utils.queryAllByTestId("daystrip-dot-minimal-sage");
    expect(sageDots.length).toBeGreaterThanOrEqual(1);
  });
});

// keep the vi import meaningful even if no spies are needed
void vi;
