/**
 * TodayActivityBonusCard — Maintenance tile rendering pins (web).
 *
 * Task build-12 H-3 (TestFlight `AAtW7dYcCBPyBdsMU6UqiQQ`, 2026-04-19):
 * the Activity Bonus summary row must render a 4th "Maintenance" tile
 * whenever the host supplies a resolved `maintenanceTdeeKcal`, and
 * must omit that tile (3-column layout) when the value is `null` or
 * `0`. Both today and past-day hosts feed the exact same
 * `resolveMaintenance`-derived value into the card, so there is no
 * legitimate path where a past day gets 4 columns and today gets 3.
 *
 * These assertions lock the `hasMaintenanceTile = value != null &&
 * value > 0` contract against regressions — previously the tile was
 * also briefly absent on today after a refactor that flipped the gate
 * to `value > 0 && isToday === false`. The tests fail if:
 *   - the tile silently renders when the value is `null`;
 *   - the tile silently renders when the value is `0`;
 *   - the tile fails to render when a positive value is supplied;
 *   - the tile count diverges between `isToday`-style and past-day-style
 *     props (i.e. the card gains a hidden `isToday` dependency).
 *
 * Mobile parity pinned by
 * `apps/mobile/tests/unit/todayActivityBonusCardMaintenanceTile.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TodayActivityBonusCard } from "../../src/app/components/suppr/today-activity-bonus-card";

// Keep React referenced so tsconfig `jsx: react-jsx` doesn't tree-shake.
void React;

type CardProps = React.ComponentProps<typeof TodayActivityBonusCard>;

/**
 * Canonical base props shared by every case. Only the fields the
 * maintenance-tile gate cares about are varied per test.
 */
function baseProps(overrides: Partial<CardProps> = {}): CardProps {
  return {
    hasBurnData: true,
    totalBurnKcal: 2100,
    effectiveCalorieTarget: 1800,
    consumedCalories: 1500,
    basalBurnKcal: 1500,
    activityBurnForSelectedDay: 600,
    workouts: [],
    weekSummaryMode: "rolling",
    weekSummaryKeys: [],
    activityBurnByDay: {},
    basalBurnByDay: {},
    nutritionByDay: {},
    selectedDateKey: "2026-04-19",
    profileMeasurementSystem: "metric",
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

describe("TodayActivityBonusCard (web) — Maintenance tile gate", () => {
  it("renders the 4th Maintenance tile when maintenanceTdeeKcal is a positive number", () => {
    render(<TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: 1777 })} />);
    const tile = screen.getByTestId("today-activity-bonus-maintenance-tile");
    expect(tile).toBeTruthy();
    expect(tile.textContent).toContain("1,777");
    expect(tile.textContent).toContain("Maintenance");
  });

  it("omits the Maintenance tile when maintenanceTdeeKcal is null (brand-new user, no profile basics)", () => {
    render(<TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: null })} />);
    expect(screen.queryByTestId("today-activity-bonus-maintenance-tile")).toBeNull();
    // Summary row still present — we didn't accidentally break the
    // 3-tile fallback.
    expect(screen.getByTestId("today-activity-bonus-summary-row")).toBeTruthy();
  });

  it("omits the Maintenance tile when maintenanceTdeeKcal is 0 (no misleading '0 kcal · Maintenance' cell)", () => {
    render(<TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: 0 })} />);
    expect(screen.queryByTestId("today-activity-bonus-maintenance-tile")).toBeNull();
  });

  it("renders the same tile count for the same resolved value regardless of selectedDateKey (today-vs-past parity)", () => {
    // Today render
    const { unmount } = render(
      <TodayActivityBonusCard
        {...baseProps({ maintenanceTdeeKcal: 1777, selectedDateKey: "2026-04-19" })}
      />,
    );
    expect(screen.getByTestId("today-activity-bonus-maintenance-tile")).toBeTruthy();
    unmount();

    // Past-day render with the exact same maintenance value
    render(
      <TodayActivityBonusCard
        {...baseProps({ maintenanceTdeeKcal: 1777, selectedDateKey: "2026-04-15" })}
      />,
    );
    expect(screen.getByTestId("today-activity-bonus-maintenance-tile")).toBeTruthy();
  });

  it("shows the info trigger when maintenance is resolved (popover surfaces the shared copy)", () => {
    render(
      <TodayActivityBonusCard
        {...baseProps({ maintenanceTdeeKcal: 1777, maintenanceSource: "formula" })}
      />,
    );
    expect(screen.getByTestId("today-activity-bonus-info-trigger")).toBeTruthy();
  });

  it("omits the info trigger when maintenance is null (no popover to show)", () => {
    render(<TodayActivityBonusCard {...baseProps({ maintenanceTdeeKcal: null })} />);
    expect(screen.queryByTestId("today-activity-bonus-info-trigger")).toBeNull();
  });
});
