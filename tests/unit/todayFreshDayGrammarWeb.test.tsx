// @vitest-environment jsdom
/**
 * Today ring fresh-day empty-state grammar (web) — ENG-1372 slice 1.
 *
 * Behind `empty_state_grammar_v1` (default-OFF): on a true fresh day (host-
 * confirmed zero logged entries) the ring's empty tick track swaps to the
 * warm-tint token (`var(--surface-warm)`), the fresh-day log pill mounts
 * inside the hero, and the BONUS stat cell collapses (law 3 — no zero-triad
 * derived numbers) while Goal/Eaten stay (honest earned zeros). Flag OFF, or
 * `isFreshDay=false`, must render byte-identical to the pre-ENG-1372 hero.
 */
import * as React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";

import { CalorieRingDial } from "../../src/app/components/suppr/calorie-ring-dial";
import { TodayHeroRing } from "../../src/app/components/suppr/today-hero-ring";
import { TodayFreshDayLogPill } from "../../src/app/components/suppr/today-fresh-day-log-pill";
import { todayFreshDayLogPillLabel, todayFreshDayLogPillSlot } from "../../src/lib/copy/today";

void React;

function forceFlag(flag: string, value: boolean): void {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    [flag]: value,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

const baseProps = {
  consumed: 0,
  target: 2000,
  proteinPct: 0,
  carbsPct: 0,
  fatPct: 0,
  expanded: false,
  onToggleExpanded: () => {},
};

describe("todayFreshDayLogPillLabel / todayFreshDayLogPillSlot", () => {
  it("names Breakfast before 11", () => {
    expect(todayFreshDayLogPillLabel(6)).toBe("Log breakfast");
    expect(todayFreshDayLogPillSlot(6)).toBe("Breakfast");
    expect(todayFreshDayLogPillLabel(10)).toBe("Log breakfast");
  });

  it("names Lunch from 11 up to (not incl.) 16", () => {
    expect(todayFreshDayLogPillLabel(11)).toBe("Log lunch");
    expect(todayFreshDayLogPillSlot(11)).toBe("Lunch");
    expect(todayFreshDayLogPillLabel(15)).toBe("Log lunch");
  });

  it("names Dinner from 16 onward", () => {
    expect(todayFreshDayLogPillLabel(16)).toBe("Log dinner");
    expect(todayFreshDayLogPillSlot(16)).toBe("Dinner");
    expect(todayFreshDayLogPillLabel(23)).toBe("Log dinner");
  });
});

describe("TodayFreshDayLogPill", () => {
  it("fires onPress and carries the time-aware label as its a11y name", () => {
    let pressed = false;
    const { getByRole } = render(
      <TodayFreshDayLogPill hour={8} onPress={() => (pressed = true)} />,
    );
    const btn = getByRole("button", { name: "Log breakfast" });
    btn.click();
    expect(pressed).toBe(true);
  });
});

describe("TodayHeroRing — fresh-day grammar gating (empty_state_grammar_v1)", () => {
  it("flag OFF (kill switch, forced — default is ON since 2026-07-07): no pill, BONUS cell present even at 0", () => {
    forceFlag("empty_state_grammar_v1", false);
    const { queryByTestId } = render(
      <TodayHeroRing {...baseProps} isFreshDay onLogFreshDaySlot={() => {}} />,
    );
    expect(queryByTestId("today-fresh-day-log-pill")).toBeNull();
    const row = queryByTestId("today-ring-stats-row");
    expect(row?.textContent ?? "").toContain("Bonus");
  });

  it("flag ON but isFreshDay=false (day has logged entries): no pill even at consumed=0", () => {
    forceFlag("empty_state_grammar_v1", true);
    const { queryByTestId } = render(
      <TodayHeroRing {...baseProps} isFreshDay={false} onLogFreshDaySlot={() => {}} />,
    );
    expect(queryByTestId("today-fresh-day-log-pill")).toBeNull();
  });

  it("flag ON + isFreshDay: renders the pill inside the hero and suppresses BONUS", () => {
    forceFlag("empty_state_grammar_v1", true);
    const { getByTestId, queryByTestId } = render(
      <TodayHeroRing {...baseProps} isFreshDay onLogFreshDaySlot={() => {}} />,
    );
    expect(getByTestId("today-fresh-day-log-pill")).toBeTruthy();
    const row = getByTestId("today-ring-stats-row");
    expect(row.textContent ?? "").not.toContain("Bonus");
    // Goal/Eaten stay — honest earned zeros (law 3 targets DERIVED emptiness only).
    expect(row.textContent ?? "").toContain("Goal");
    expect(row.textContent ?? "").toContain("Eaten");
  });

  it("flag ON + isFreshDay but a real bonus exists: BONUS cell still renders", () => {
    forceFlag("empty_state_grammar_v1", true);
    const { getByTestId } = render(
      <TodayHeroRing {...baseProps} baseGoal={1800} isFreshDay onLogFreshDaySlot={() => {}} />,
    );
    const row = getByTestId("today-ring-stats-row");
    expect(row.textContent ?? "").toContain("Bonus");
    expect(row.textContent ?? "").toContain("+200");
  });
});

describe("CalorieRingDial — emptyTrackWarm (ENG-1372 law 1)", () => {
  it("defaults to the standard --ring-tick fill", () => {
    const { container } = render(<CalorieRingDial consumed={0} target={2000} />);
    const tick = container.querySelector('rect[fill="var(--ring-tick)"]');
    expect(tick).not.toBeNull();
  });

  it("swaps every tick to --surface-warm when emptyTrackWarm is true", () => {
    const { container } = render(
      <CalorieRingDial consumed={0} target={2000} emptyTrackWarm />,
    );
    expect(container.querySelector('rect[fill="var(--ring-tick)"]')).toBeNull();
    expect(container.querySelectorAll('rect[fill="var(--surface-warm)"]').length).toBe(48);
  });
});
