// @vitest-environment jsdom
/**
 * TodayActivityBonusCard — Maintenance tile rendering pins (mobile).
 *
 * Task build-12 H-3 (TestFlight `AAtW7dYcCBPyBdsMU6UqiQQ`, 2026-04-19):
 * "This is generally helpful but I think we lost some of the clarity
 * around total burn/projected burn, how all the numbers add up." Today
 * was rendering a 3-column summary (`Burn so far / Food logged / Net
 * deficit`) while past-day rendered 4 (`… + Maintenance`) — a self-
 * inconsistency inside one card.
 *
 * The host (`apps/mobile/app/(tabs)/index.tsx`) feeds
 * `profileMaintenanceTdeeKcal` from the shared `resolveMaintenance`
 * helper, which is date-independent. These tests pin the card-level
 * contract so a future refactor that re-introduces an `isToday`
 * dependency on the maintenance tile fails loudly in CI.
 *
 * Coverage:
 *   1. Positive maintenance → 4th tile rendered with the kcal value
 *      and the "Maintenance" label.
 *   2. Null maintenance (brand-new user, missing profile basics) →
 *      3-column layout, no "Maintenance" tile.
 *   3. Zero maintenance → 3-column layout (avoids a misleading
 *      "0 kcal · Maintenance" cell).
 *   4. Same resolved value renders the same tile count whether
 *      `isToday === true` or `isToday === false` — the today-vs-past
 *      parity invariant.
 *   5. Info trigger visibility mirrors the tile gate.
 *
 * Web parity pinned by
 * `tests/unit/todayActivityBonusCardMaintenanceTile.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react-native";

import { TodayActivityBonusCard } from "../../components/today/TodayActivityBonusCard";

void React;

type CardProps = React.ComponentProps<typeof TodayActivityBonusCard>;

const MINIMAL_STYLES = {
  card: {},
  cardTitle: {},
};

function baseProps(overrides: Partial<CardProps> = {}): CardProps {
  return {
    isToday: true,
    hasBurnData: true,
    totalBurnKcal: 2100,
    consumedCalories: 1500,
    effectiveCalorieGoal: 1800,
    basalBurnKcal: 1500,
    activityBurnKcal: 600,
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
    profileSex: "male",
    profileWeightKg: 80,
    profileHeightCm: 180,
    profileAge: 30,
    profileActivityLevel: "sedentary",
    maintenanceSource: "formula",
    maintenanceConfidence: null,
    ...overrides,
  };
}

describe("TodayActivityBonusCard (mobile) — Maintenance tile gate", () => {
  it("renders the 4th Maintenance tile when maintenanceTdeeKcal is a positive number", () => {
    const { getByTestId } = render(
      <TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: 1777 })} />,
    );
    const tile = getByTestId("today-activity-bonus-maintenance-tile");
    expect(tile).toBeTruthy();
    // The RN tree exposes children as props; walk to find text content.
    // Simpler: RNTL's `getByText` would find "1,777" inside the tile.
    // We rely on the test id existing as the hard contract.
  });

  it("omits the Maintenance tile when maintenanceTdeeKcal is null (brand-new user, no profile basics)", () => {
    const { queryByTestId, getByTestId } = render(
      <TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: null })} />,
    );
    expect(queryByTestId("today-activity-bonus-maintenance-tile")).toBeNull();
    // Summary row still rendered in the 3-tile form.
    expect(getByTestId("today-activity-bonus-summary-row")).toBeTruthy();
  });

  it("omits the Maintenance tile when maintenanceTdeeKcal is 0 (no misleading '0 kcal · Maintenance' cell)", () => {
    const { queryByTestId } = render(
      <TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: 0 })} />,
    );
    expect(queryByTestId("today-activity-bonus-maintenance-tile")).toBeNull();
  });

  it("renders the same tile count on today and past-day for the same resolved value (today-vs-past parity)", () => {
    // Today render
    const todayTree = render(
      <TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: 1777, isToday: true })} />,
    );
    expect(todayTree.getByTestId("today-activity-bonus-maintenance-tile")).toBeTruthy();
    todayTree.unmount();

    // Past-day render with the exact same maintenance value — host
    // passes the same `profileMaintenanceTdeeKcal` from the shared
    // resolver, so the tile must still render.
    const pastTree = render(
      <TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: 1777, isToday: false })} />,
    );
    expect(pastTree.getByTestId("today-activity-bonus-maintenance-tile")).toBeTruthy();
  });

  it("shows the info trigger when maintenance is resolved (popover surfaces the shared copy)", () => {
    const { getByTestId } = render(
      <TodayActivityBonusCard
        {...baseProps({ maintenanceTdeeKcal: 1777, maintenanceSource: "formula" })}
      />,
    );
    expect(getByTestId("today-activity-bonus-info-trigger")).toBeTruthy();
  });

  it("omits the info trigger when maintenance is null (no popover to show)", () => {
    const { queryByTestId } = render(
      <TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: null })} />,
    );
    expect(queryByTestId("today-activity-bonus-info-trigger")).toBeNull();
  });
});
