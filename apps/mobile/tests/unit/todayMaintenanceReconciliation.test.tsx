// @vitest-environment jsdom

/**
 * ENG-1373 — maintenance-number reconciliation (mobile).
 *
 * Pins the fix for the ticket's "Today's Activity card says '0 kcal
 * maintenance' directly above 'MAINTENANCE 2,117'" contradiction:
 *
 *   - `TodayWeekView`'s "Goal: … (above ~N kcal maintenance) from Health"
 *     footnote must NEVER render a literal "0" — when there's no real
 *     maintenance signal (`maintenanceKcal == null`), the whole
 *     parenthetical clause is omitted rather than showing "0 kcal
 *     maintenance".
 *   - `TodayWeekSummaryStats`'s burn-reference fallback treats `null`
 *     exactly like `0` (never crashes, never fabricates a positive
 *     number from a null signal).
 *   - Both are fed by `resolveMaintenance`-only data
 *     (`profileMaintenanceTdeeKcal`) — the same value that gates the
 *     Activity Bonus "MAINTENANCE 2,117" tile — so the two cards can no
 *     longer disagree about whether a maintenance number exists.
 */

import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => true,
}));

import {
  TodayWeekView,
  type TodayWeekDay,
} from "../../components/today/TodayWeekView";
import { TodayWeekSummaryStats } from "../../components/today/TodayWeekSummaryStats";

function buildDay(i: number, short: string, calories: number): TodayWeekDay {
  return {
    key: `2026-05-${String(i + 1).padStart(2, "0")}`,
    short,
    date: new Date(2026, 4, i + 1),
    totals: { calories, protein: 0, carbs: 0, fat: 0 },
  };
}

const SEVEN_DAYS: TodayWeekDay[] = Array.from({ length: 7 }, (_, i) =>
  buildDay(i, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]!, 1800),
);
const SEVEN_GOALS = [2000, 2000, 2000, 2000, 2000, 2000, 2000];

const weekViewProps = (overrides?: Partial<React.ComponentProps<typeof TodayWeekView>>) => ({
  days: SEVEN_DAYS,
  weekTotals: { calories: 12600, protein: 0, carbs: 0, fat: 0 },
  weekAvg: { calories: 1800, protein: 0, carbs: 0, fat: 0 },
  daysWithFood: 7,
  weekEffectiveCalorieBudget: 14000,
  calorieTarget: 2000,
  proteinTarget: 100,
  carbsTarget: 200,
  fatTarget: 60,
  preferActivityAdjustedCalories: true,
  activityBonusCaloriesOnly: true,
  maintenanceKcal: null as number | null,
  dayGoals: SEVEN_GOALS,
  onSelectDay: vi.fn(),
  styles: {
    card: { padding: 12, backgroundColor: "#fff" },
    cardTitle: { fontWeight: "700" },
    macroBarBlock: {},
    macroBarTop: {},
    macroBarTitle: {},
    macroBarNums: {},
    macroBarTrack: {},
    macroBarFill: {},
  } as Record<string, any>,
  textColor: "#000",
  textSecondaryColor: "#555",
  textTertiaryColor: "#888",
  borderColor: "#eee",
  ...overrides,
});

describe("TodayWeekView — maintenance footnote never fabricates '0' (ENG-1373)", () => {
  it("omits the maintenance clause entirely when maintenanceKcal is null", () => {
    const { getByTestId, queryByText } = render(
      <TodayWeekView {...weekViewProps({ maintenanceKcal: null })} />,
    );
    // Footnote still renders (the goal line itself), just without the
    // parenthetical maintenance clause.
    const footnote = getByTestId("today-week-goal-footnote");
    const text = ([] as unknown[]).concat(footnote.props.children).join("");
    expect(text).not.toMatch(/0 kcal maintenance/);
    expect(text).not.toContain("kcal maintenance");
    expect(queryByText(/0 kcal maintenance/)).toBeNull();
  });

  it("shows the real maintenance number when maintenanceKcal is a positive signal", () => {
    const { getByTestId } = render(
      <TodayWeekView {...weekViewProps({ maintenanceKcal: 2117 })} />,
    );
    const footnote = getByTestId("today-week-goal-footnote");
    const text = ([] as unknown[]).concat(footnote.props.children).join("");
    expect(text).toContain("above ~2117 kcal maintenance");
  });

  it("also omits the clause for a non-positive maintenanceKcal (defensive: never render 0)", () => {
    const { getByTestId } = render(
      <TodayWeekView {...weekViewProps({ maintenanceKcal: 0 })} />,
    );
    const footnote = getByTestId("today-week-goal-footnote");
    const text = ([] as unknown[]).concat(footnote.props.children).join("");
    expect(text).not.toMatch(/0 kcal maintenance/);
  });
});

describe("TodayWeekSummaryStats — null-safe burn-reference fallback (ENG-1373)", () => {
  const baseProps = {
    totalCalories: 3400,
    avgCalories: 1700,
    accentPrimarySolid: "#3B2A4D",
    textColor: "#221B26",
    textSecondaryColor: "#6A6072",
    cardStyle: {},
    cardTitleStyle: {},
  };

  it("suppresses the deficit/surplus verdict when there's no burn signal (never fabricates 'Net surplus' from a zero denominator)", () => {
    // ENG-1373 finding 5 — burnReference falls back to
    // Math.max(0, null ?? 0) * 7 = 0 when there's no HealthKit burn data
    // AND no resolvable maintenance. Comparing totalCalories against that
    // zero isn't a real deficit/surplus verdict — it's "no burn signal" —
    // so the tile must render the honest days-logged fallback instead of
    // a fabricated "Net surplus 3400".
    const { getByText, queryByText, getByTestId } = render(
      <TodayWeekSummaryStats {...baseProps} daysWithFood={5} maintenanceKcal={null} />,
    );
    expect(queryByText("Net surplus")).toBeNull();
    expect(queryByText("Net deficit")).toBeNull();
    expect(getByTestId("today-week-net-burn-unavailable")).toBeTruthy();
    expect(getByText("5/7 days logged")).toBeTruthy();
  });

  it("still computes the real net figure when maintenanceKcal is a positive signal", () => {
    const { getByText } = render(
      <TodayWeekSummaryStats {...baseProps} daysWithFood={5} maintenanceKcal={2117} />,
    );
    // burnReference = 2117 * 7 = 14819 >= totalCalories (3400) → "Net deficit".
    expect(getByText("Net deficit")).toBeTruthy();
    expect(getByText("11419")).toBeTruthy();
  });
});
