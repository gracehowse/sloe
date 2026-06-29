// @vitest-environment jsdom
/**
 * DayStrip — v3 prototype selected-cell indicator (ENG-1247, 2026-06-24).
 *
 * The v3 prototype `.day-cell.is-sel` fills the WHOLE selected cell with plum
 * and inverts its day-letter / date / dot to white. This supersedes the
 * 2026-06-10 soft-tint pill (and is NOT the clay solid pill rejected in
 * 2026-06-03 — the prototype's fill is plum + white, a clean inversion, and the
 * prototype is now canonical). Today-not-selected keeps an accent number;
 * logged days keep a sage dot.
 *
 * Two layers are pinned here:
 *   1. `dayStripIndicator` — the pure state→treatment decision (selectedFill,
 *      number/dot colour, accent precedence) shared web ↔ mobile.
 *   2. The rendered `DayStrip` — the selected cell carries the plum fill and the
 *      minimal dot testIDs are present.
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
  accent: Accent.primary,
  sage: Accent.success,
  text: "#1A1A1A",
  onAccent: Accent.primaryForeground,
};

describe("dayStripIndicator — pure state→treatment decision (v3 filled cell)", () => {
  it("selected day: FULL plum fill, white number, no dot (unlogged)", () => {
    const out = dayStripIndicator(
      { isSelected: true, isToday: false, hasLogs: false },
      COLORS,
    );
    expect(out.selectedFill).toBe(true);
    expect(out.cellBg).toBe(Accent.primary);
    expect(out.numberColor).toBe(Accent.primaryForeground);
    expect(out.dotKind).toBe("none");
    // the selected cell uses the white on-accent treatment, not the accent number
    expect(out.isActive).toBe(false);
  });

  it("selected AND logged: plum fill + WHITE dot (onAccent), white number", () => {
    const out = dayStripIndicator(
      { isSelected: true, isToday: false, hasLogs: true },
      COLORS,
    );
    expect(out.selectedFill).toBe(true);
    expect(out.dotKind).toBe("onAccent");
    expect(out.dotColor).toBe(Accent.primaryForeground);
    expect(out.numberColor).toBe(Accent.primaryForeground);
    // the sage "logged" dot must NOT win when the day is also selected
    expect(out.dotColor).not.toBe(Accent.success);
  });

  it("today (not selected): accent number, NO fill, no dot", () => {
    const out = dayStripIndicator(
      { isSelected: false, isToday: true, hasLogs: false },
      COLORS,
    );
    expect(out.numberColor).toBe(Accent.primary);
    expect(out.isActive).toBe(true);
    expect(out.selectedFill).toBe(false);
    expect(out.cellBg).toBe("transparent");
    expect(out.dotKind).toBe("none");
    expect(out.dotColor).toBe("transparent");
  });

  it("logged (not selected): sage dot, neutral number, no fill", () => {
    const out = dayStripIndicator(
      { isSelected: false, isToday: false, hasLogs: true },
      COLORS,
    );
    expect(out.dotKind).toBe("sage");
    expect(out.dotColor).toBe(Accent.success);
    expect(out.numberColor).toBe(COLORS.text);
    expect(out.selectedFill).toBe(false);
    expect(out.isActive).toBe(false);
  });

  it("plain day: no dot, neutral number, no fill", () => {
    const out = dayStripIndicator(
      { isSelected: false, isToday: false, hasLogs: false },
      COLORS,
    );
    expect(out.dotKind).toBe("none");
    expect(out.dotColor).toBe("transparent");
    expect(out.numberColor).toBe(COLORS.text);
    expect(out.selectedFill).toBe(false);
    expect(out.cellBg).toBe("transparent");
  });

  it("selected + today + logged: fill wins (white number + white dot)", () => {
    const out = dayStripIndicator(
      { isSelected: true, isToday: true, hasLogs: true },
      COLORS,
    );
    expect(out.selectedFill).toBe(true);
    expect(out.cellBg).toBe(Accent.primary);
    expect(out.numberColor).toBe(Accent.primaryForeground);
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

describe("DayStrip render — selected cell fills plum, minimal dots present", () => {
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

  it("renders minimal dot testIDs and the SELECTED cell carries the plum fill", () => {
    const utils = renderStrip(new Set<string>());

    // The minimal-indicator dots exist in the tree (the redesigned render path).
    const dots = utils.queryAllByTestId(/^daystrip-dot-minimal-/);
    expect(dots.length).toBeGreaterThan(0);

    // v3: exactly the SELECTED (today) day cell fills with plum. Find day-cell
    // Pressables by their signature (paddingVertical:8 + alignItems:center +
    // gap:4) and assert exactly one carries the accent fill.
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
    // Exactly the selected (today) cell carries a non-transparent fill. The
    // accent value comes from `useAccent()`, so assert "filled" not a literal;
    // and `findAll` returns BOTH the composite Pressable and its host View per
    // cell, so filter to host nodes to count each cell once.
    const filled = dayCells.filter((cell) => {
      if (typeof (cell as { type?: unknown }).type !== "string") return false;
      const style = flattenStyle((cell.props as { style?: unknown })?.style);
      const bg = style.backgroundColor;
      return typeof bg === "string" && bg !== "transparent";
    });
    expect(filled).toHaveLength(1);
  });

  it("today's (selected, unlogged) tile renders no status dot — the fill carries selection", () => {
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

  it("exposes the week chevrons (prototype `.day-nav`)", () => {
    const utils = renderStrip(new Set<string>());
    expect(utils.getByLabelText("Previous week")).toBeTruthy();
    expect(utils.getByLabelText("Next week")).toBeTruthy();
  });
});

// keep the vi import meaningful even if no spies are needed
void vi;
