// @vitest-environment jsdom
/**
 * TodayActivityBonusCard — Apple Health empty-state copy branches on the
 * REAL connection state (ENG-1534, mobile).
 *
 * Bug: the energy empty-state reused the not-connected copy ("No resting or
 * active energy … enable Apple Health …") for EVERY user with no burn data
 * for the day — including already-connected users who simply hadn't synced /
 * moved yet. A connected user was told to "enable Apple Health" they'd
 * already enabled (state conflation).
 *
 * Fix: the host resolves the real connection state via
 * `useAppleHealthConnected()` and passes `appleHealthConnected`. These tests
 * pin the card-level contract:
 *   - connected  → calm "no data yet" copy, no "enable Apple Health" nag.
 *   - not connected / unknown → the enable instruction (unchanged).
 *   - the empty state only appears when there's no burn data for the day.
 *
 * Web parity: N/A — the web twin (`today-activity-bonus-card.tsx`) returns
 * null when `!hasBurnData`, so it never renders this copy (Apple Health is
 * iOS-only; web reads mobile-written `health_snapshots`).
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayActivityBonusCard } from "../../components/today/TodayActivityBonusCard";

void React;

type CardProps = React.ComponentProps<typeof TodayActivityBonusCard>;

const MINIMAL_STYLES = { card: {}, cardTitle: {} };

function baseProps(overrides: Partial<CardProps> = {}): CardProps {
  return {
    isToday: true,
    // The empty state is gated on `!hasBurnData && isToday`.
    hasBurnData: false,
    totalBurnKcal: 0,
    consumedCalories: 0,
    effectiveCalorieGoal: 1800,
    basalBurnKcal: 0,
    activityBurnKcal: 0,
    todayActivityBudgetAddon: 0,
    dayWorkouts: [],
    trackerWeekSummaryKeys: [],
    activityBurnByDay: {},
    basalBurnByDay: {},
    byDay: {},
    weekSummaryMode: "rolling",
    onOpenBurnDetail: () => undefined,
    styles: MINIMAL_STYLES,
    textColor: "#fff",
    textSecondaryColor: "#aaa",
    textTertiaryColor: "#888",
    borderColor: "#222",
    cardColor: "#111",
    cardBorderColor: "#222",
    maintenanceTdeeKcal: null,
    ...overrides,
  };
}

describe("TodayActivityBonusCard (mobile) — Apple Health empty-state copy (ENG-1534)", () => {
  it("connected user with no data → calm 'no data yet' copy, NO enable nag", () => {
    const { getByTestId, queryByTestId, queryByText } = render(
      <TodayActivityBonusCard {...baseProps({ appleHealthConnected: true })} />,
    );
    expect(getByTestId("today-activity-bonus-energy-empty-connected")).toBeTruthy();
    expect(
      queryByTestId("today-activity-bonus-energy-empty-disconnected"),
    ).toBeNull();
    // The whole point of the fix: a connected user is never told to enable.
    expect(queryByText(/enable Apple Health/)).toBeNull();
    expect(queryByText(/No activity data for this day yet/)).toBeTruthy();
  });

  it("not-connected user → the enable instruction (unchanged)", () => {
    const { getByTestId, queryByTestId, queryByText } = render(
      <TodayActivityBonusCard {...baseProps({ appleHealthConnected: false })} />,
    );
    expect(
      getByTestId("today-activity-bonus-energy-empty-disconnected"),
    ).toBeTruthy();
    expect(
      queryByTestId("today-activity-bonus-energy-empty-connected"),
    ).toBeNull();
    expect(queryByText(/enable Apple Health/)).toBeTruthy();
  });

  it("unknown connection state (null, probe in flight) → conservative enable copy", () => {
    const { getByTestId } = render(
      <TodayActivityBonusCard {...baseProps({ appleHealthConnected: null })} />,
    );
    expect(
      getByTestId("today-activity-bonus-energy-empty-disconnected"),
    ).toBeTruthy();
  });

  it("omitted prop (other hosts) → enable copy — preserves legacy behaviour", () => {
    const { getByTestId } = render(
      <TodayActivityBonusCard {...baseProps({ appleHealthConnected: undefined })} />,
    );
    expect(
      getByTestId("today-activity-bonus-energy-empty-disconnected"),
    ).toBeTruthy();
  });

  it("no empty state at all once there IS burn data for the day", () => {
    const { queryByTestId } = render(
      <TodayActivityBonusCard
        {...baseProps({ hasBurnData: true, totalBurnKcal: 2100, appleHealthConnected: true })}
      />,
    );
    expect(
      queryByTestId("today-activity-bonus-energy-empty-connected"),
    ).toBeNull();
    expect(
      queryByTestId("today-activity-bonus-energy-empty-disconnected"),
    ).toBeNull();
  });
});
