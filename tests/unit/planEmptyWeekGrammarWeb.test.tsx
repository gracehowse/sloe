// @vitest-environment jsdom
/**
 * PlanV3Surface — empty-week grammar (ENG-1372 slice 1, web).
 *
 * Behind `empty_state_grammar_v1` (default-OFF): a week with ZERO real meals
 * in ANY slot (isPlanWeekEmpty) swaps the verdict row + day-detail zero-triad
 * for one warm PlanEmptyWeekCard ("Nothing planned yet" + filled "Generate
 * this week" + ghost "or add meals as you go"). A week with even one real
 * meal keeps the normal verdict + day-detail band untouched. Mirrors mobile
 * `apps/mobile/tests/unit/planEmptyWeekGrammar.test.tsx`.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";

import { PlanV3Surface } from "../../src/app/components/plan/PlanV3Surface";
import type { DayPlan, DayPlanMeal } from "../../src/types/recipe";

void React;

function forceFlag(flag: string, value: boolean): void {
  (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__ = {
    [flag]: value,
  };
}

afterEach(() => {
  delete (window as { __SUPPR_FORCE_FLAGS__?: Record<string, boolean> }).__SUPPR_FORCE_FLAGS__;
});

const m = (calories: number, placeholder = true): DayPlanMeal => ({
  name: "Meal",
  recipeTitle: placeholder ? "" : "Meal",
  calories,
  protein: 30,
  carbs: 40,
  fat: 15,
  isPlaceholder: placeholder,
});

const emptyDay = (): DayPlan => ({
  day: 0,
  meals: [m(0, true), m(0, true), m(0, true)],
  totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
});
const fullDay = (): DayPlan => ({
  day: 0,
  meals: [m(500, false), m(600, false), m(700, false)],
  totals: { calories: 1800, protein: 120, carbs: 150, fat: 55 },
});

const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 15 + i));
const today = new Date(2026, 5, 18);

const baseProps = {
  targetKcal: 1830,
  weekDates,
  weekLabel: "15–21 June",
  verdict: {
    daysHit: 0,
    total: 7,
    headline: "On track — 0 of 7 days land",
    subline: "7 days need a meal or swap",
    tone: "warning" as const,
  },
  household: null,
  onGenerate: () => {},
  onAdjust: () => {},
  onTemplates: () => {},
  onOpenHousehold: () => {},
  onOpenMeal: () => {},
  onAddToSlot: () => {},
  shoppingItemCount: 0,
  servingCount: 1,
  onOpenShopping: () => {},
  onOpenBatchCook: () => {},
  batchCookSubtitle: "Cook once · scale shopping",
  today,
};

describe("PlanV3Surface — empty-week grammar gating", () => {
  it("flag OFF (default): fully-empty week still shows the legacy verdict + zero-triad", () => {
    const plan = Array.from({ length: 7 }, emptyDay);
    const { queryByTestId, getByText } = render(<PlanV3Surface {...baseProps} plan={plan} />);
    expect(queryByTestId("plan-empty-week-card")).toBeNull();
    expect(getByText("On track — 0 of 7 days land")).not.toBeNull();
    expect(getByText("Nothing planned yet")).not.toBeNull(); // day-detail zero-triad subline
  });

  it("flag ON + fully-empty week: renders the warm invitation card, hides the verdict row", () => {
    forceFlag("empty_state_grammar_v1", true);
    const plan = Array.from({ length: 7 }, emptyDay);
    const { getByTestId, queryByText, queryByTestId } = render(
      <PlanV3Surface {...baseProps} plan={plan} />,
    );
    expect(getByTestId("plan-empty-week-card")).toBeTruthy();
    expect(queryByText("On track — 0 of 7 days land")).toBeNull();
    expect(queryByTestId("plan-day-detail-band")).toBeNull();
  });

  it("flag ON but the week has ANY real meal: keeps the normal verdict + day-detail band", () => {
    forceFlag("empty_state_grammar_v1", true);
    const plan = [fullDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay(), emptyDay()];
    const { queryByTestId, getByText } = render(
      <PlanV3Surface
        {...baseProps}
        plan={plan}
        verdict={{
          daysHit: 0,
          total: 7,
          headline: "On track — 0 of 7 days land",
          subline: "7 days need a meal or swap",
          tone: "warning",
        }}
      />,
    );
    expect(queryByTestId("plan-empty-week-card")).toBeNull();
    expect(getByText("On track — 0 of 7 days land")).not.toBeNull();
  });

  it("'or add meals as you go' dismisses the card for this session, revealing the day-detail band", () => {
    forceFlag("empty_state_grammar_v1", true);
    const plan = Array.from({ length: 7 }, emptyDay);
    const { getByText, queryByTestId, getByTestId } = render(
      <PlanV3Surface {...baseProps} plan={plan} />,
    );
    expect(getByTestId("plan-empty-week-card")).toBeTruthy();
    fireEvent.click(getByText("or add meals as you go"));
    expect(queryByTestId("plan-empty-week-card")).toBeNull();
    expect(getByTestId("plan-day-detail-band")).toBeTruthy();
  });
});
