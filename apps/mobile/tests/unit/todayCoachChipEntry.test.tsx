// @vitest-environment jsdom
/**
 * Today hero Coach chip (ENG-1293, sweep decision #3 2026-07-01).
 *
 * The only /coach entries used to be welded to the conditional deficit line
 * (gated `remaining > 0 && isToday && !fasting`), so the entry vanished
 * exactly when the user needed it — over budget, all logged, past days,
 * fasting (verified V6/V23). This pins the replacement: an always-present
 * labelled "Coach" chip in the hero chip row that renders in EVERY hero
 * state whenever the host provides `onPressCoach` (which it gates on
 * `coach_screen_v1`, same flag as the Coach screen).
 *
 * Render tests cover the carded hero (decard flag default-OFF); a source
 * grep pins that the de-carded v3 branch keeps the chip row alive too.
 */
import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";

import { TodayHeroRing } from "../../components/today/TodayHeroRing";

void React;

const baseProps = {
  goal: 2000,
  baseGoal: 2000,
  textColor: "#000",
  secondaryColor: "#666",
  trackColor: "#ddd",
  cardBackgroundColor: "#fff",
  borderColor: "#eee",
  textTertiaryColor: "#999",
  proteinPct: 0.5,
  carbsPct: 0.5,
  fatPct: 0.5,
  expanded: false,
  onToggleExpanded: () => {},
};

describe("TodayHeroRing — always-present Coach chip (ENG-1293)", () => {
  it("renders the Coach chip and fires onPressCoach on tap", () => {
    const onPressCoach = vi.fn();
    const { getByTestId } = render(
      <TodayHeroRing {...baseProps} consumed={1200} onPressCoach={onPressCoach} />,
    );
    const chip = getByTestId("today-coach-chip");
    fireEvent.press(chip);
    expect(onPressCoach).toHaveBeenCalledTimes(1);
  });

  it("renders the Coach chip when OVER budget (the state the old entry vanished in)", () => {
    const { getByTestId, getByText } = render(
      <TodayHeroRing {...baseProps} consumed={2600} onPressCoach={() => {}} />,
    );
    expect(getByTestId("today-coach-chip")).toBeTruthy();
    // The over-budget status signal still renders alongside it (as the
    // status chip on the carded hero, or the ring status line on the
    // default-ON de-carded v3 hero).
    expect(getByText(/Over budget/)).toBeTruthy();
  });

  it("renders the Coach chip on an empty day (fresh start)", () => {
    const { getByTestId } = render(
      <TodayHeroRing {...baseProps} consumed={0} onPressCoach={() => {}} />,
    );
    expect(getByTestId("today-coach-chip")).toBeTruthy();
  });

  it("renders no Coach chip when the host withholds onPressCoach (coach_screen_v1 off)", () => {
    const { queryByTestId } = render(
      <TodayHeroRing {...baseProps} consumed={1200} />,
    );
    expect(queryByTestId("today-coach-chip")).toBeNull();
  });
});

describe("TodayHeroRing source — decard branch keeps the Coach chip row (ENG-1293)", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "..", "components", "today", "TodayHeroRing.tsx"),
    "utf8",
  );

  it("chip row renders when decard is on and onPressCoach is present (foot slot on the ENG-1653 cluster hero)", () => {
    // The row condition must keep `!decard || onPressCoach` — a plain
    // `!decard` would drop the always-present entry from the v3 de-carded
    // hero. ENG-1653 adds `!coachAtFoot`: on the tight-cluster hero the top
    // row is dropped and the SAME chip renders at the hero foot instead, so
    // the entry still exists in every hero state in both layouts.
    expect(src).toMatch(/\(!decard \|\| onPressCoach\) && !coachAtFoot \?/);
    expect(src).toMatch(/<TodayCoachChip onPress=\{onPressCoach\} \/>/);
    expect(src).toMatch(/\{coachAtFoot && onPressCoach \? <TodayCoachChip onPress=\{onPressCoach\} \/> : null\}/);
  });

  it("host gate is documented as coach_screen_v1 (same flag as the screen)", () => {
    expect(src).toMatch(/coach_screen_v1/);
  });
});
