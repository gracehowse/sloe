/**
 * TodayActivityBonusCard — daily-average divides by LOGGED days (web).
 *
 * 2026-05-26 fix (Grace): the "Avg daily deficit/surplus" line must
 * divide the windowed energy balance by the number of days the user
 * actually LOGGED, not a hardcoded /7. Mid-week a calendar-week window
 * has only the elapsed days logged; dividing by 7 diluted the average
 * toward zero with the empty future days.
 *
 * Canonical example from the spec: a 2-logged-day calendar window with
 * per-day net deficits of −800 and −220 (sum 1,020) must read as
 * ~510 kcal/day, NOT ~146/day (= 1,020 / 7, the old bug).
 *
 * The weekly TOTAL + projected mass still sum over all window days
 * (unchanged) — only the AVERAGE switched denominator. This test
 * renders the card and reads the rendered avg line so it fails if the
 * denominator regresses to /7 (or to days-with-burn instead of
 * days-with-meals).
 *
 * Mobile parity: the identical calc lives in
 * `apps/mobile/components/today/TodayDeficitInsight.tsx`
 * (`weekBurn - weekConsumed) / loggedDays`) and is pinned by the
 * shared helper coverage in `weekSummaryWindow.test.ts`.
 */

import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { TodayActivityBonusCard } from "../../src/app/components/suppr/today-activity-bonus-card";

// Keep React referenced so tsconfig `jsx: react-jsx` doesn't tree-shake.
void React;

type CardProps = React.ComponentProps<typeof TodayActivityBonusCard>;

/**
 * Build a calendar-week window where exactly two days have meals logged.
 * Day A: 800 kcal burn, 0 consumed → net deficit 800.
 * Day B: 220 kcal burn, 0 consumed → net deficit 220.
 * The remaining five window days have NO meals (and no burn) — they must
 * be excluded from the average. loggedDays = 2 → avg = (800+220)/2 = 510.
 */
function twoLoggedDayProps(): CardProps {
  const keys = [
    "2026-04-06", // Mon — Day A (logged)
    "2026-04-07", // Tue — Day B (logged)
    "2026-04-08", // Wed — no meals
    "2026-04-09",
    "2026-04-10",
    "2026-04-11",
    "2026-04-12", // Sun
  ];
  return {
    hasBurnData: true,
    totalBurnKcal: 800,
    effectiveCalorieTarget: 1800,
    consumedCalories: 0,
    basalBurnKcal: 800,
    activityBurnForSelectedDay: 0,
    workouts: [],
    weekSummaryMode: "calendar_week",
    weekSummaryKeys: keys,
    // Burn lives entirely in basal so the net == burn for these days.
    basalBurnByDay: { "2026-04-06": 800, "2026-04-07": 220 },
    activityBurnByDay: {},
    // Only Day A + Day B have meals; both consumed 0 so net = burn.
    nutritionByDay: {
      "2026-04-06": [{ calories: 0 }],
      "2026-04-07": [{ calories: 0 }],
    },
    selectedDateKey: "2026-04-06",
    profileMeasurementSystem: "metric",
    maintenanceTdeeKcal: null,
    profileSex: "male",
    profileWeightKg: 80,
    profileHeightCm: 180,
    profileAge: 30,
    profileActivityLevel: "sedentary",
    maintenanceSource: "formula",
    maintenanceConfidence: null,
  };
}

/** Read the numeric kcal value rendered next to a given summary label. */
function valueForLabel(label: string): string {
  const labelEl = screen.getByText(label);
  // The row is a flex container: label span + value span. Grab the row
  // (parent) and read the value sibling's text.
  const row = labelEl.parentElement as HTMLElement;
  return within(row).getByText(/kcal$/).textContent ?? "";
}

describe("TodayActivityBonusCard (web) — daily average divides by logged days", () => {
  it("reports ~510 kcal/day for a 2-logged-day window (−800, −220), not ~146 (/7 bug)", () => {
    render(<TodayActivityBonusCard {...twoLoggedDayProps()} />);

    // Both days are deficits, so the label reads "Avg daily deficit".
    const avgText = valueForLabel("Avg daily deficit");
    expect(avgText).toContain("510");
    // Guard against the old /7 denominator (1,020 / 7 ≈ 146) and against
    // accidentally averaging over all 7 window days.
    expect(avgText).not.toContain("146");
    expect(avgText).not.toContain("145");
  });

  it("still sums the WEEKLY total over the whole window (unchanged by the avg fix)", () => {
    render(<TodayActivityBonusCard {...twoLoggedDayProps()} />);
    // Weekly deficit = total burn (800 + 220) − total consumed (0) = 1,020.
    const weeklyText = valueForLabel("Weekly deficit");
    expect(weeklyText).toContain("1,020");
  });

  it("excludes days with burn but no logged meals from the average denominator", () => {
    // Add a third window day that has BURN but NO meals — it must not
    // count toward loggedDays (so the avg stays 510, not (1020+X)/3).
    const props = twoLoggedDayProps();
    props.basalBurnByDay = {
      ...props.basalBurnByDay,
      "2026-04-08": 900, // burn on an unlogged day
    };
    render(<TodayActivityBonusCard {...props} />);
    const avgText = valueForLabel("Avg daily deficit");
    expect(avgText).toContain("510");
  });
});
